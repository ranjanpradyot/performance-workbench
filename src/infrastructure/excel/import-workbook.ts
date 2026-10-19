import ExcelJS from "exceljs";
import { normalizeStatus, parseQuarterLabel, quarterBounds, slug } from "@/domain/status";
import type {
  AchievementStatus,
  AssessmentRuleSet,
  DocumentNote,
  ExportProfile,
  KpiAssessment,
  KpiDefinition,
  LearningEvidence,
  MetricSnapshot,
  OkrChecklistEntry,
  ProcessAssessment,
  ProcessChecklistItem,
  ProcessScorecell,
  Reportee,
  ScorecardLine,
  SheetNarrative,
  Ticket,
  WorkbenchDataset,
} from "@/domain/types";
import { cellText, findHeader, headerIndex, sheetRows, type ParsedCell } from "./cells";
import { emptyDataset, touchQuarter, upsertYear } from "./dataset";
import { reporteeColor } from "@/theme/reportee-colors";

const KPI_SKIP = /^(2 quarter|expected|achieved|total|quarterly score|expected =)/i;

export interface WorkbookImportResult {
  dataset: WorkbenchDataset;
  sheetNames: string[];
  warnings: string[];
}

function now(): string {
  return new Date().toISOString();
}

function textAt(row: ParsedCell[], index: number): string | undefined {
  const value = cellText(row, index);
  return value ?? undefined;
}

function numberAt(row: ParsedCell[], index: number): number | null {
  const cell = row[index];
  if (!cell || cell.text == null) return null;
  if (cell.number != null) return cell.number;
  const parsed = Number(cell.text);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function importWorkbook(data: ArrayBuffer | Buffer, fileName: string, colorIndex = 0): Promise<WorkbookImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);
  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  const warnings: string[] = [];
  const dataset = emptyDataset();
  dataset.application.seededFrom = [fileName];

  const matrices = new Map<string, ParsedCell[][]>();
  workbook.eachSheet((sheet) => {
    matrices.set(sheet.name, sheetRows(sheet, Math.max(sheet.columnCount, 24)));
  });

  const checklistName = sheetNames.find((name) => name.endsWith("_OKR_Checklist"));
  const masterName = sheetNames.find((name) => name.startsWith("Tickets_Master_"));
  const reporteeName = detectName(matrices, checklistName, fileName);
  const reporteeId = `rep_${slug(reporteeName)}`;
  const timestamp = now();

  const reportee: Reportee = {
    id: reporteeId,
    fullName: reporteeName,
    status: "active",
    themeColor: reporteeColor(colorIndex),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const scoreModelFormulas: string[] = [];
  const definitions: KpiDefinition[] = [];
  const assessments: KpiAssessment[] = [];

  for (const [name, rows] of matrices) {
    const yearMatch = /^KPI_(\d{4})$/.exec(name);
    if (!yearMatch) continue;
    const year = Number(yearMatch[1]);
    upsertYear(dataset, year);
    const headerAt = findHeader(rows, ["KPI", "Weightage", "Year"]);
    if (headerAt < 0) {
      warnings.push(`${name}: KPI header row was not found.`);
      continue;
    }
    const header = rows[headerAt];
    const groups = quarterGroups(header, year);
    const titleCol = headerIndex(header, ["Title"]);
    const rmCol = headerIndex(header, ["RM"]);
    const idCol = headerIndex(header, ["EmployeeID"]);
    const nameCol = headerIndex(header, ["EmployeeName"]);
    let order = 0;
    for (let index = headerAt + 1; index < rows.length; index += 1) {
      const row = rows[index];
      const kpiName = textAt(row, 0);
      if (!kpiName) continue;
      if (KPI_SKIP.test(kpiName)) continue;
      order += 1;
      const weightCell = row[headerIndex(header, ["Weightage"])] ?? row[3];
      const weight = readWeight(weightCell);
      if (weight.formula) scoreModelFormulas.push(weight.formula);
      if (!reportee.employeeId && idCol >= 0) {
        const idCell = row[idCol];
        if (idCell && !idCell.formula && idCell.text && /^\d+$/.test(idCell.text)) reportee.employeeId = idCell.text;
      }
      if (nameCol >= 0 && textAt(row, nameCol)) reportee.fullName = textAt(row, nameCol) ?? reportee.fullName;
      if (titleCol >= 0 && textAt(row, titleCol) && !reportee.role) reportee.role = textAt(row, titleCol);
      if (rmCol >= 0 && textAt(row, rmCol) && !reportee.manager) reportee.manager = textAt(row, rmCol);
      const definitionId = `kpi_${reporteeId}_${year}_${slug(kpiName)}`;
      definitions.push({
        id: definitionId,
        reporteeId,
        year,
        name: kpiName,
        sourceLabel: kpiName,
        category: kpiName,
        annualWeight: weight.annual,
        scopedWeight: weight.scoped,
        weightFormula: weight.formula,
        assessmentMethod: "Manager Yes/No. Yes awards the quarter weight. No awards 0. Pending is not scored as zero.",
        active: true,
        displayOrder: order,
        title: titleCol >= 0 ? textAt(row, titleCol) : undefined,
        extension: rmCol >= 0 && textAt(row, rmCol) ? { RM: textAt(row, rmCol) ?? "" } : undefined,
      });
      for (const group of groups) {
        const parsed = parseQuarterLabel(group.label);
        if (!parsed) continue;
        touchQuarter(dataset, parsed.year, parsed.quarterNumber, "under_review");
        const target = textAt(row, group.target);
        const actual = textAt(row, group.actual);
        const achieved = textAt(row, group.achieved);
        if (!target && !actual && !achieved) continue;
        const status = achieved ? normalizeStatus(achieved) : "pending";
        assessments.push({
          id: `kpa_${reporteeId}_${parsed.id}_${slug(kpiName)}`,
          reporteeId,
          quarterId: parsed.id,
          kpiDefinitionId: definitionId,
          target,
          actual,
          status,
          recordedStatus: status,
          weightUsed: null,
          evidenceRefs: textAt(row, group.link) ? [textAt(row, group.link)!] : [],
          manualOverride: false,
          inheritedTemplate: false,
          updatedAt: timestamp,
        });
      }
    }
    pushNarrative(dataset, reporteeId, name, rows, sheetNames.indexOf(name));
  }

  const checklistRows = checklistName ? matrices.get(checklistName) ?? [] : [];
  const checklistHeaderAt = findHeader(checklistRows, ["Employee Name", "Quarter", "OKRs"]);
  if (checklistName && checklistHeaderAt >= 0) {
    const header = checklistRows[checklistHeaderAt];
    const columns = {
      name: headerIndex(header, ["Employee Name"]),
      quarter: headerIndex(header, ["Quarter"]),
      kpi: headerIndex(header, ["KPI Affected"]),
      met: headerIndex(header, ["OKR Met?"]),
      weight: headerIndex(header, ["Weightage"]),
      artifacts: headerIndex(header, ["Artifacts to OKR"]),
      links: headerIndex(header, ["Other Links"]),
      okrs: headerIndex(header, ["OKRs"]),
      deliverable: headerIndex(header, ["Deliverable Expected"]),
      note: headerIndex(header, ["Evidence Note"]),
    };
    for (let index = checklistHeaderAt + 1; index < checklistRows.length; index += 1) {
      const row = checklistRows[index];
      const okrs = textAt(row, columns.okrs);
      const quarterLabel = textAt(row, columns.quarter);
      if (!okrs && !quarterLabel) continue;
      const parsed = quarterLabel ? parseQuarterLabel(quarterLabel) : null;
      if (quarterLabel && !parsed) warnings.push(`${checklistName} row ${index + 1}: quarter "${quarterLabel}" is not a Qn-YYYY label.`);
      if (parsed) touchQuarter(dataset, parsed.year, parsed.quarterNumber, "under_review");
      const entry: OkrChecklistEntry = {
        id: `okr_${reporteeId}_${index + 1}`,
        reporteeId,
        quarterId: parsed?.id ?? "",
        employeeName: textAt(row, columns.name) ?? reportee.fullName,
        kpiAffected: textAt(row, columns.kpi) ?? "",
        okrMet: normalizeStatus(textAt(row, columns.met)),
        weightage: numberAt(row, columns.weight),
        artifacts: textAt(row, columns.artifacts) ?? row[columns.artifacts]?.link,
        otherLinks: textAt(row, columns.links) ?? row[columns.links]?.link,
        okrs: okrs ?? "",
        deliverableExpected: textAt(row, columns.deliverable),
        evidenceNote: textAt(row, columns.note),
        sourceRow: index + 1,
        updatedAt: timestamp,
      };
      if (!entry.quarterId) warnings.push(`${checklistName} row ${index + 1}: checklist line has no quarter and was kept with a blank quarter reference.`);
      const definition = definitions.find((item) => item.sourceLabel === entry.kpiAffected && (!parsed || item.year === parsed.year));
      entry.kpiDefinitionId = definition?.id;
      dataset.okrChecklistEntries.push(entry);
    }
    pushNarrative(dataset, reporteeId, checklistName, checklistRows, sheetNames.indexOf(checklistName));
  } else if (checklistName) {
    warnings.push(`${checklistName}: checklist header was not found.`);
  }

  const tickets = parseTickets(matrices, masterName, reporteeId, timestamp, warnings, dataset);
  applyCodeChangeLinks(matrices, tickets, warnings);
  applyDefectFlags(matrices, tickets, reporteeId, warnings);
  dataset.tickets = tickets;

  parseLearning(matrices, reporteeId, dataset, timestamp, warnings);
  parseScorecard(matrices, reporteeId, dataset, warnings);
  applyScorecardWeights(definitions, assessments, dataset.scorecardLines);
  parseProcess(matrices, reporteeId, dataset, timestamp);
  parseDocumentSummary(matrices, reporteeId, dataset);
  parseMetricSheets(matrices, reporteeId, dataset, warnings);
  for (const name of sheetNames) {
    if (!dataset.sheetNarratives.some((item) => item.reporteeId === reporteeId && item.sheet === name)) {
      pushNarrative(dataset, reporteeId, name, matrices.get(name) ?? [], sheetNames.indexOf(name));
    }
  }

  const rules = buildRules(reporteeId, definitions, scoreModelFormulas, dataset, timestamp);
  dataset.assessmentRules.push(rules);
  dataset.exportProfiles.push(buildProfile(reporteeId, reportee.fullName, sheetNames, matrices));
  dataset.reportees.push(reportee);
  dataset.kpiDefinitions = definitions;
  dataset.kpiAssessments = assessments.filter((row) => row.quarterId);
  return { dataset, sheetNames, warnings };
}

function detectName(matrices: Map<string, ParsedCell[][]>, checklistName: string | undefined, fileName: string): string {
  if (checklistName) {
    const rows = matrices.get(checklistName) ?? [];
    const headerAt = findHeader(rows, ["Employee Name"]);
    if (headerAt >= 0) {
      const name = cellText(rows[headerAt + 1], headerIndex(rows[headerAt], ["Employee Name"]));
      if (name) return name;
    }
    const fromSheet = checklistName.replace(/_OKR_Checklist$/, "").replace(/_/g, " ");
    if (fromSheet) return fromSheet;
  }
  const fromFile = fileName.split(/[/\\]/).pop()?.split("_")[0];
  return fromFile || "Reportee";
}

function quarterGroups(header: ParsedCell[], year: number): Array<{ label: string; target: number; actual: number; achieved: number; link: number }> {
  const groups = [];
  for (let index = 0; index < header.length; index += 1) {
    const match = /^Q([1-4])Target$/i.exec(header[index]?.text ?? "");
    if (!match) continue;
    const prefix = `Q${match[1]}`;
    groups.push({
      label: `${prefix}-${year}`,
      target: index,
      actual: headerIndex(header, [`${prefix}Actual`]),
      achieved: headerIndex(header, [`${prefix}Achieved`]),
      link: findLinkColumn(header, index),
    });
  }
  return groups;
}

function findLinkColumn(header: ParsedCell[], targetIndex: number): number {
  for (let index = targetIndex; index < Math.min(header.length, targetIndex + 5); index += 1) {
    if ((header[index]?.text ?? "").toLowerCase() === "okr link") return index;
  }
  return -1;
}

function readWeight(cell: ParsedCell | undefined): { annual: number | null; scoped: number | null; formula?: string } {
  if (!cell || (cell.text == null && !cell.formula)) return { annual: null, scoped: null };
  if (cell.formula) {
    const match = /(\d+(?:\.\d+)?)\s*\/\s*4\s*\*\s*(\d+(?:\.\d+)?)/.exec(cell.formula);
    if (match) {
      const annual = Number(match[1]);
      const quarters = Number(match[2]);
      return { annual, scoped: cell.number ?? (annual / 4) * quarters, formula: cell.formula };
    }
    return { annual: cell.number, scoped: cell.number, formula: cell.formula };
  }
  return { annual: cell.number, scoped: cell.number };
}

function parseTickets(
  matrices: Map<string, ParsedCell[][]>,
  masterName: string | undefined,
  reporteeId: string,
  timestamp: string,
  warnings: string[],
  dataset: WorkbenchDataset,
): Ticket[] {
  const sourceName = masterName ?? [...matrices.keys()].find((name) => name.endsWith("_Tickets") && !name.includes("Ticket_Summary"));
  if (!sourceName) {
    warnings.push("No ticket master sheet was found.");
    return [];
  }
  const rows = matrices.get(sourceName) ?? [];
  const headerAt = findHeader(rows, ["Ticket No.", "Status"]);
  if (headerAt < 0) {
    warnings.push(`${sourceName}: ticket header was not found.`);
    return [];
  }
  const header = rows[headerAt];
  const col = (name: string) => headerIndex(header, [name]);
  const tickets: Ticket[] = [];
  for (let index = headerAt + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const ticketNo = textAt(row, col("Ticket No."));
    if (!ticketNo || !/^\d+$/.test(ticketNo)) continue;
    const quarterLabel = textAt(row, col("Quarter"));
    const parsed = quarterLabel ? parseQuarterLabel(quarterLabel) : null;
    if (quarterLabel && !parsed) warnings.push(`${sourceName} row ${index + 1}: quarter "${quarterLabel}" was not recognised.`);
    if (parsed) touchQuarter(dataset, parsed.year, parsed.quarterNumber, "under_review");
    const prior = tickets.filter((item) => item.ticketNo === ticketNo);
    if (prior.length) {
      warnings.push(`${sourceName} row ${index + 1}: ticket ${ticketNo} also appears in ${prior.map((item) => item.quarterId ?? "an earlier row").join(", ")}. Both rows are kept because the status or dates differ.`);
    }
    const idSuffix = prior.length ? `_${parsed?.id ?? index + 1}` : "";
    const extension: Record<string, string> = {};
    header.forEach((cell, column) => {
      const name = cell.text;
      if (!name) return;
      const known = ["Ticket No.", "Description", "Status", "Month", "Assign Date", "Closure Date", "Owner", "SP Change", "Code Change", "Code Lines Changed", "SQL Lines Changed", "Quarter", "Cycle Days"];
      if (!known.includes(name) && textAt(row, column)) extension[name] = textAt(row, column)!;
    });
    tickets.push({
      id: `tkt_${reporteeId}_${ticketNo}${idSuffix}`,
      reporteeId,
      ticketNo,
      description: textAt(row, col("Description")),
      status: textAt(row, col("Status")),
      month: row[col("Month")]?.date ?? textAt(row, col("Month")),
      assignDate: row[col("Assign Date")]?.date ?? textAt(row, col("Assign Date")),
      closureDate: row[col("Closure Date")]?.date ?? textAt(row, col("Closure Date")),
      owner: textAt(row, col("Owner")),
      spChange: textAt(row, col("SP Change")),
      codeChange: textAt(row, col("Code Change")),
      codeLines: numberAt(row, col("Code Lines Changed")),
      sqlLines: numberAt(row, col("SQL Lines Changed")),
      quarterId: parsed?.id,
      cycleDays: numberAt(row, col("Cycle Days")),
      sourceSheet: sourceName,
      extension: Object.keys(extension).length ? extension : undefined,
      updatedAt: timestamp,
    });
  }
  return tickets;
}

function applyCodeChangeLinks(matrices: Map<string, ParsedCell[][]>, tickets: Ticket[], warnings: string[]): void {
  const rows = matrices.get("CodeChange_Tickets");
  if (!rows) return;
  const headerAt = findHeader(rows, ["Ticket No."]);
  if (headerAt < 0) return;
  const header = rows[headerAt];
  const ticketCol = headerIndex(header, ["Ticket No."]);
  const urlCol = header.findIndex((cell) => (cell.text ?? "").toLowerCase().includes("azure_pr_url") || (cell.text ?? "").toLowerCase().includes("pr url"));
  if (urlCol < 0) return;
  for (let index = headerAt + 1; index < rows.length; index += 1) {
    const ticketNo = textAt(rows[index], ticketCol);
    const url = textAt(rows[index], urlCol) ?? rows[index][urlCol]?.link;
    const quarterLabel = textAt(rows[index], headerIndex(header, ["Quarter"]));
    const parsed = quarterLabel ? parseQuarterLabel(quarterLabel) : null;
    if (!ticketNo || !url) continue;
    const ticket = tickets.find((item) => item.ticketNo === ticketNo && (!parsed || item.quarterId === parsed.id)) ?? tickets.find((item) => item.ticketNo === ticketNo);
    if (!ticket) {
      warnings.push(`CodeChange_Tickets row ${index + 1}: ticket ${ticketNo} is not in the master.`);
      continue;
    }
    ticket.azurePrUrl = url;
  }
}

function applyDefectFlags(matrices: Map<string, ParsedCell[][]>, tickets: Ticket[], reporteeId: string, warnings: string[]): void {
  const rows = matrices.get("Customer_Defect_Themes");
  if (!rows) return;
  const headerAt = rows.findIndex((row) => row.some((cell) => (cell.text ?? "").toLowerCase().startsWith("defect-like")));
  if (headerAt < 0) return;
  const header = rows[headerAt];
  const ticketCol = headerIndex(header, ["Ticket No."]);
  const flagCol = header.findIndex((cell) => (cell.text ?? "").toLowerCase().startsWith("defect-like"));
  for (let index = headerAt + 1; index < rows.length; index += 1) {
    const ticketNo = textAt(rows[index], ticketCol);
    const flag = textAt(rows[index], flagCol);
    const quarterLabel = textAt(rows[index], headerIndex(header, ["Quarter"]));
    const parsed = quarterLabel ? parseQuarterLabel(quarterLabel) : null;
    if (!ticketNo || !/^\d+$/.test(ticketNo) || !flag) continue;
    const ticket = tickets.find((item) => item.ticketNo === ticketNo && (!parsed || item.quarterId === parsed.id)) ?? tickets.find((item) => item.ticketNo === ticketNo);
    if (!ticket) {
      warnings.push(`Customer_Defect_Themes row ${index + 1}: ticket ${ticketNo} is not in the master for ${reporteeId}.`);
      continue;
    }
    ticket.defectLike = normalizeStatus(flag) === "achieved";
  }
}

function parseLearning(
  matrices: Map<string, ParsedCell[][]>,
  reporteeId: string,
  dataset: WorkbenchDataset,
  timestamp: string,
  warnings: string[],
): void {
  const rows = matrices.get("Learning_Evidence");
  if (!rows) return;
  const headerAt = findHeader(rows, ["Quarter"]);
  if (headerAt < 0) {
    warnings.push("Learning_Evidence: header row was not found.");
    return;
  }
  const header = rows[headerAt];
  const col = (...names: string[]) => headerIndex(header, names);
  let sequence = 0;
  for (let index = headerAt + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const quarterLabel = textAt(row, col("Quarter"));
    const focus = textAt(row, col("POC / Focus Area", "POC / Course"));
    if (!quarterLabel && !focus) continue;
    const parsed = quarterLabel ? parseQuarterLabel(quarterLabel) : null;
    if (quarterLabel && !parsed) warnings.push(`Learning_Evidence row ${index + 1}: quarter "${quarterLabel}" was not recognised.`);
    if (parsed) touchQuarter(dataset, parsed.year, parsed.quarterNumber, "planning");
    sequence += 1;
    const known = new Set(["Quarter", "KPI", "POC / Focus Area", "POC / Course", "Problem Statement", "Acceptance Criteria", "Tech Stack", "Evidence Link / Path", "Achieved/Not Achieved", "Yes/No", "Primary Deliverable", "Primary Deliverable / Outcome", "Comments"]);
    const extension: Record<string, string> = {};
    header.forEach((cell, column) => {
      if (cell.text && !known.has(cell.text) && textAt(row, column)) extension[cell.text] = textAt(row, column)!;
    });
    const statusText = textAt(row, col("Achieved/Not Achieved", "Yes/No"));
    const evidence: LearningEvidence = {
      id: `lrn_${reporteeId}_${parsed?.id ?? "unscoped"}_${sequence}`,
      reporteeId,
      quarterId: parsed?.id ?? "",
      kpi: textAt(row, col("KPI")),
      focusArea: focus,
      problemStatement: textAt(row, col("Problem Statement")),
      acceptanceCriteria: textAt(row, col("Acceptance Criteria")),
      techStack: textAt(row, col("Tech Stack")),
      evidenceLink: textAt(row, col("Evidence Link / Path")) ?? row[col("Evidence Link / Path")]?.link,
      status: statusText ? normalizeStatus(statusText) : "pending",
      primaryDeliverable: textAt(row, col("Primary Deliverable / Outcome", "Primary Deliverable")),
      comments: textAt(row, col("Comments")),
      extension: Object.keys(extension).length ? extension : undefined,
      updatedAt: timestamp,
    };
    dataset.learningEvidence.push(evidence);
  }
}

function parseScorecard(
  matrices: Map<string, ParsedCell[][]>,
  reporteeId: string,
  dataset: WorkbenchDataset,
  warnings: string[],
): void {
  const rows = matrices.get("Actual_vs_Achieved_Scorecard");
  if (!rows) return;
  const headerAt = findHeader(rows, ["Quarter", "KPI Area"]);
  if (headerAt < 0) {
    warnings.push("Actual_vs_Achieved_Scorecard: header row was not found.");
    return;
  }
  const header = rows[headerAt];
  const col = (...names: string[]) => headerIndex(header, names);
  for (let index = headerAt + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const quarterLabel = textAt(row, col("Quarter"));
    const kpiArea = textAt(row, col("KPI Area"));
    if (!quarterLabel || !kpiArea) continue;
    if (/^VALIDATION/i.test(quarterLabel) || /^Scope$/i.test(quarterLabel) || /^Per-quarter/i.test(quarterLabel)) break;
    const parsed = parseQuarterLabel(quarterLabel);
    if (!parsed) continue;
    touchQuarter(dataset, parsed.year, parsed.quarterNumber, "under_review");
    const line: ScorecardLine = {
      id: `sc_${reporteeId}_${parsed.id}_${slug(kpiArea)}_${index}`,
      reporteeId,
      quarterId: parsed.id,
      kpiArea,
      metric: textAt(row, col("Metric")) ?? "",
      target: textAt(row, col("Target")),
      actual: textAt(row, col("Actual")),
      status: normalizeStatus(textAt(row, col("Yes/No", "Yes"))),
      weightage: numberAt(row, col("Weightage (KPI)")),
      evidenceSheet: textAt(row, col("Evidence Sheet")),
      sourceKpiTarget: textAt(row, col("Source KPI Target (short)")),
      validationNotes: textAt(row, col("Validation Notes", "Notes")) ?? textAt(row, col("Validation Notes")),
      isQuarterTotal: /quarter score/i.test(kpiArea),
    };
    if (!line.validationNotes) {
      const extra = row.map((cell) => cell.text).filter(Boolean).slice(9).join(" ");
      if (extra) line.validationNotes = extra;
    }
    dataset.scorecardLines.push(line);
  }
}

function applyScorecardWeights(definitions: KpiDefinition[], assessments: KpiAssessment[], lines: ScorecardLine[]): void {
  for (const assessment of assessments) {
    const definition = definitions.find((item) => item.id === assessment.kpiDefinitionId);
    const line = lines.find((item) => item.reporteeId === assessment.reporteeId && item.quarterId === assessment.quarterId && item.kpiArea === definition?.sourceLabel && !item.isQuarterTotal);
    if (line?.weightage != null) {
      assessment.weightUsed = line.weightage;
      continue;
    }
    if (definition?.weightFormula && definition.annualWeight != null) assessment.weightUsed = definition.annualWeight / 4;
    else if (definition?.annualWeight != null) assessment.weightUsed = definition.annualWeight;
  }
}

function parseProcess(matrices: Map<string, ParsedCell[][]>, reporteeId: string, dataset: WorkbenchDataset, timestamp: string): void {
  const rows = matrices.get("Helpdesk_Discipline");
  if (!rows) return;
  const measureAt = rows.findIndex((row) => (row[0]?.text ?? "").toLowerCase() === "measure #");
  const checklistItems: ProcessChecklistItem[] = [];
  if (measureAt >= 0) {
    const header = rows[measureAt];
    for (let index = measureAt + 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row[0]?.text) break;
      if (/^\d+$/.test(row[0].text ?? "") === false && index > measureAt + 1) break;
      const processCol = headerIndex(header, ["Process Item"]);
      checklistItems.push({
        measureNo: textAt(row, 0),
        processItem: processCol >= 0 ? textAt(row, processCol) : undefined,
        whatIsMeasured: textAt(row, headerIndex(header, ["What is measured"])),
        evidence: textAt(row, headerIndex(header, ["Evidence / How checked"])),
        source: textAt(row, headerIndex(header, ["Source"])),
        target: textAt(row, headerIndex(header, ["Target"])),
      });
    }
  }
  const scoreAt = rows.findIndex((row) => (row[0]?.text ?? "").toLowerCase() === "process item" && row.some((cell) => /^Q[1-4]-\d{4}$/i.test(cell.text ?? "")));
  const scorecard: ProcessScorecell[] = [];
  let overallStatus: AchievementStatus = "pending";
  let overallComment: string | undefined;
  if (scoreAt >= 0) {
    const header = rows[scoreAt];
    const quarters = header
      .map((cell, index) => ({ index, label: cell.text ?? "" }))
      .filter((cell) => /^Q[1-4]-\d{4}$/i.test(cell.label));
    for (let index = scoreAt + 1; index < rows.length; index += 1) {
      const label = rows[index][0]?.text;
      if (!label) break;
      if (/process adherence overall/i.test(label)) {
        overallStatus = normalizeStatus(rows[index].map((cell) => cell.text).find((value) => value && normalizeStatus(value) !== "pending") ?? undefined);
        overallComment = rows[index].map((cell) => cell.text).filter(Boolean).slice(2).join(" ");
        break;
      }
      const byQuarter: Record<string, AchievementStatus | "missing"> = {};
      for (const quarter of quarters) {
        const parsed = parseQuarterLabel(quarter.label);
        const raw = textAt(rows[index], quarter.index);
        if (!parsed) continue;
        byQuarter[parsed.id] = raw ? normalizeStatus(raw) : "missing";
      }
      const overallCol = headerIndex(header, ["Overall Achieved?"]);
      const commentCol = headerIndex(header, ["Comments"]);
      scorecard.push({
        item: label,
        byQuarter,
        overall: overallCol >= 0 ? normalizeStatus(textAt(rows[index], overallCol)) : undefined,
        comments: commentCol >= 0 ? textAt(rows[index], commentCol) : undefined,
      });
    }
  }
  const note = rows.map((row) => row[0]?.text).find((value) => value && /ticket export cannot prove/i.test(value));
  const assessment: ProcessAssessment = {
    id: `proc_${reporteeId}`,
    reporteeId,
    narrative: note ?? undefined,
    checklistItems,
    scorecard,
    overallStatus,
    overallComment,
    updatedAt: timestamp,
  };
  dataset.processAssessments.push(assessment);
}

function parseDocumentSummary(matrices: Map<string, ParsedCell[][]>, reporteeId: string, dataset: WorkbenchDataset): void {
  const rows = matrices.get("Document_Summary");
  if (!rows) return;
  const headerAt = findHeader(rows, ["Version", "Area", "Change"]);
  if (headerAt < 0) return;
  for (let index = headerAt + 1; index < rows.length; index += 1) {
    const change = textAt(rows[index], 2);
    if (!change) continue;
    const note: DocumentNote = {
      id: `doc_${reporteeId}_${index}`,
      reporteeId,
      version: textAt(rows[index], 0),
      area: textAt(rows[index], 1),
      change,
    };
    dataset.documentNotes.push(note);
  }
}

const METRIC_SHEETS = ["Ticket_Velocity", "Ticket_Spillover", "FirstCut_Quality", "CodeChange_Summary", "SLA_CycleDays", "Customer_Defect_Themes", "Rework_Reopen_Proxy", "OKR_Summary", "OKR_Checklist_Summary"];

function parseMetricSheets(matrices: Map<string, ParsedCell[][]>, reporteeId: string, dataset: WorkbenchDataset, warnings: string[]): void {
  for (const name of METRIC_SHEETS) {
    const rows = matrices.get(name);
    if (!rows) continue;
    const headerAt = rows.findIndex((row) => {
      const first = (row[0]?.text ?? "").trim().toLowerCase();
      return first === "quarter" || first.startsWith("quarter /") || first.startsWith("quarter/") || first.startsWith("kpi");
    });
    if (headerAt < 0) {
      warnings.push(`${name}: no tabular header was found. Title and notes are still kept.`);
      continue;
    }
    const header = rows[headerAt].map((cell, index) => cell.text ?? `Column ${index + 1}`);
    let carriedQuarter: string | undefined;
    for (let index = headerAt + 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.some((cell) => cell.text)) continue;
      if (/^(MASTER TOTALS|VALIDATION|Ticket-level|1\)|2\)|3\))/i.test(row[0]?.text ?? "")) break;
      const values: Record<string, string> = {};
      header.forEach((column, columnIndex) => {
        const value = textAt(row, columnIndex);
        if (value) values[column] = value;
      });
      if (Object.keys(values).length === 0) continue;
      const label = values.Quarter ?? values["Quarter / KPI"];
      const quarter = label ? parseQuarterLabel(label) : null;
      const isTotal = Boolean(label && /grand total/i.test(label));
      const scored = Boolean(values.No || values.Yes || values["Grand Total"] || values["Yes/No"] || values["Achieved/Not Achieved"]);
      const quarterId = quarter?.id ?? (!isTotal && scored ? carriedQuarter : undefined);
      if (quarter) carriedQuarter = quarter.id;
      if (isTotal) carriedQuarter = undefined;
      const statusRaw = values["Yes/No"] ?? values["Achieved/Not Achieved"] ?? values["Yes"] ?? values["PR Rejection Achieved"];
      const snapshot: MetricSnapshot = {
        id: `snap_${reporteeId}_${slug(name)}_${index}`,
        reporteeId,
        sheet: name,
        quarterId,
        values,
        status: statusRaw ? normalizeStatus(statusRaw) : undefined,
        comment: values.Comments ?? values.Comment,
      };
      dataset.metricSnapshots.push(snapshot);
    }
  }
}

function buildRules(
  reporteeId: string,
  definitions: KpiDefinition[],
  formulas: string[],
  dataset: WorkbenchDataset,
  timestamp: string,
): AssessmentRuleSet {
  const snapshots = dataset.metricSnapshots;
  const scoped = formulas.some((formula) => /\/\s*4/.test(formula)) || definitions.some((item) => item.weightFormula?.includes("/4"));
  const velocityTargets: Record<string, number | null> = {};
  const training: string[] = [];
  for (const snapshot of snapshots.filter((item) => item.sheet === "Ticket_Velocity" && item.quarterId)) {
    const raw = snapshot.values.Target;
    if (!snapshot.quarterId) continue;
    if (raw == null || raw === "—" || raw === "-" || raw.toLowerCase() === "n/a") velocityTargets[snapshot.quarterId] = null;
    else {
      const target = Number(raw);
      velocityTargets[snapshot.quarterId] = Number.isFinite(target) ? target : null;
    }
    const comment = `${snapshot.comment ?? ""} ${snapshot.values.Comments ?? ""}`;
    if (/training|pm yes/i.test(comment)) training.push(snapshot.quarterId);
  }
  const reworkNote = dataset.sheetNarratives.find((item) => item.reporteeId === reporteeId && item.sheet === "Rework_Reopen_Proxy")?.note ?? "";
  const countWaitStates = /onhold/i.test(reworkNote) && !/not counted/i.test(reworkNote);
  const reworkTarget = dataset.scorecardLines.find((line) => /rework/i.test(`${line.target ?? ""} ${line.metric}`))?.target ?? "";
  const reworkPercent = /rework\s*<=?\s*(\d+(?:\.\d+)?)\s*%/i.exec(reworkTarget);
  return {
    id: `rule_${reporteeId}`,
    reporteeId,
    version: 1,
    scoreModel: scoped ? "scoped_quarter_weight" : "full_annual_each_quarter",
    inScopeQuarterIds: ["q3-2025", "q4-2025", "q1-2026", "q2-2026"],
    closedStatuses: ["Closed", "Resolved", "RESOLVED"],
    quarterAssignment: "workbook_quarter_authoritative",
    quarterAssignmentNote: "Historical tickets keep the workbook Quarter column. That column was derived from Closure Date, else Month, else Assign Date. New tickets use the same precedence and the result is visible before save.",
    velocity: { thresholdRatio: 0.7, useFloor: true, trainingQuarterIds: training },
    velocityTargets,
    spill: { maxOpen: 2, maxSpillPercent: 20, combiner: "or" },
    sla: { maxAverageCycleDays: 45 },
    defect: { maxThemes: 4, keywordSuggestion: ["error", "incorrect", "bug", "duplicate", "missing"] },
    rework: {
      maxRatePercent: reworkPercent ? Number(reworkPercent[1]) : countWaitStates ? 20 : 5,
      countWaitStates,
      keywords: ["rework", "reopen", "re-open", "reopened"],
    },
    prRejectionMaxPercent: 10,
    processMinPercent: 90,
    notes: scoped
      ? [
          "v0.3 score rule: a KPI marked Yes receives the full quarter weight (annual / 4). A KPI marked No receives 0. Partial checklist lines are preserved but do not replace the KPI-level Yes/No.",
          "Missing evidence stays unassessed. It is not converted to zero.",
        ]
      : [
          "This workbook scores each quarter with the full annual KPI weight on the scorecard (a quarter can show 100). The 2026 OKR checklist uses smaller line weights, so the checklist total and the scorecard total are both retained and are not forced to match.",
          "Q3-2025 may be a training / KT override. Ticket velocity is not treated as a failure when the workbook records a PM Yes.",
        ],
    updatedAt: timestamp,
  };
}

function buildProfile(reporteeId: string, name: string, sheetNames: string[], matrices: Map<string, ParsedCell[][]>): ExportProfile {
  const learningAt = sheetNames.indexOf("Learning_Evidence");
  const velocityAt = sheetNames.indexOf("Ticket_Velocity");
  const codeHeader = (matrices.get("CodeChange_Summary") ?? []).find((row) => row.some((cell) => (cell.text ?? "").toLowerCase() === "quarter"));
  const helpdeskHeader = (matrices.get("Helpdesk_Discipline") ?? []).find((row) => (row[0]?.text ?? "").toLowerCase() === "measure #");
  const scoreHeader = (matrices.get("Actual_vs_Achieved_Scorecard") ?? []).find((row) => row.some((cell) => (cell.text ?? "").toLowerCase() === "quarter"));
  const kpiHeader = (matrices.get("KPI_2025") ?? []).find((row) => row.some((cell) => (cell.text ?? "").toLowerCase() === "kpi"));
  return {
    id: `profile_${reporteeId}`,
    reporteeId,
    checklistSheetName: `${name}_OKR_Checklist`,
    masterSheetName: `Tickets_Master_${name}`,
    includeDocumentSummary: sheetNames.includes("Document_Summary"),
    learningPosition: learningAt >= 0 && velocityAt >= 0 && learningAt > velocityAt ? "before_master" : "before_velocity",
    codeChangeHasPrColumns: Boolean(codeHeader?.some((cell) => (cell.text ?? "").toLowerCase().includes("pr rejection"))),
    helpdeskHasProcessItemColumn: Boolean(helpdeskHeader?.some((cell) => (cell.text ?? "").toLowerCase() === "process item")),
    kpiHasRmColumn: Boolean(kpiHeader?.some((cell) => (cell.text ?? "").toLowerCase() === "rm")),
    scorecardHasSourceTargetColumn: Boolean(scoreHeader?.some((cell) => (cell.text ?? "").toLowerCase().includes("source kpi"))),
    sheetOrder: sheetNames,
  };
}

function pushNarrative(dataset: WorkbenchDataset, reporteeId: string, sheet: string, rows: ParsedCell[][], order: number): void {
  const title = rows.map((row) => row[0]?.text).find((value) => value && value.length > 8 && !value.includes("!A"));
  const note = rows.map((row) => row[0]?.text).find((value) => value && value !== title && value.length > 20);
  const narrative: SheetNarrative = {
    id: `nar_${reporteeId}_${slug(sheet)}`,
    reporteeId,
    sheet,
    title: title ?? undefined,
    note: note ?? undefined,
    order,
  };
  dataset.sheetNarratives.push(narrative);
}

export function quarterTemplate(year: number, quarterNumber: number) {
  return quarterBounds(year, quarterNumber);
}
