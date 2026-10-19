import ExcelJS from "exceljs";
import { checklistScore, spillover, summarizeTickets, ticketsForQuarter, velocity } from "@/domain/calculations";
import { quarterLabel } from "@/domain/status";
import type { ExportProfile, Reportee, Ticket, WorkbenchDataset } from "@/domain/types";

const NAVY = "FF1F4E79";
const HEADER_FONT = "Calibri";

function profileFor(dataset: WorkbenchDataset, reporteeId: string): ExportProfile {
  const profile = dataset.exportProfiles.find((item) => item.reporteeId === reporteeId);
  if (!profile) throw new Error(`No Excel export profile is stored for reportee ${reporteeId}.`);
  return profile;
}

export function exportSheetOrder(dataset: WorkbenchDataset, reportee: Reportee): string[] {
  const profile = profileFor(dataset, reportee.id);
  const renamed = profile.sheetOrder.map((sheet) => renameSheet(sheet, reportee.fullName));
  const generated = dataset.quarters
    .filter((quarter) => dataset.tickets.some((ticket) => ticket.reporteeId === reportee.id && ticket.quarterId === quarter.id))
    .flatMap((quarter) => [`${quarter.label}_Tickets`, `${quarter.label}_Ticket_Summary`]);
  const quarterSheets = [...new Set([...renamed.filter((sheet) => /Q[1-4]-\d{4}_Ticket/.test(sheet)), ...generated])].sort(compareQuarterSheet);
  const staticSheets = renamed.filter((sheet) => !/Q[1-4]-\d{4}_Ticket/.test(sheet));
  const masterIndex = staticSheets.findIndex((sheet) => sheet.startsWith("Tickets_Master_"));
  if (masterIndex < 0) return [...staticSheets, ...quarterSheets];
  return [...staticSheets.slice(0, masterIndex + 1), ...quarterSheets, ...staticSheets.slice(masterIndex + 1)];
}

function renameSheet(sheet: string, name: string): string {
  if (sheet.endsWith("_OKR_Checklist")) return `${name}_OKR_Checklist`;
  if (sheet.startsWith("Tickets_Master_")) return `Tickets_Master_${name}`;
  return sheet;
}

function compareQuarterSheet(a: string, b: string): number {
  const left = /Q([1-4])-(\d{4})/.exec(a);
  const right = /Q([1-4])-(\d{4})/.exec(b);
  if (!left || !right) return a.localeCompare(b);
  const year = Number(left[2]) - Number(right[2]);
  if (year !== 0) return year;
  const quarter = Number(left[1]) - Number(right[1]);
  if (quarter !== 0) return quarter;
  return a.includes("_Summary") === b.includes("_Summary") ? a.localeCompare(b) : a.includes("_Summary") ? 1 : -1;
}

export async function exportReporteeWorkbook(dataset: WorkbenchDataset, reporteeId: string): Promise<ExcelJS.Buffer> {
  const reportee = dataset.reportees.find((item) => item.id === reporteeId);
  if (!reportee) throw new Error(`Reportee ${reporteeId} was not found.`);
  const profile = profileFor(dataset, reporteeId);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS Workbench";
  workbook.created = new Date();
  const order = exportSheetOrder(dataset, reportee);
  for (const name of order) {
    const sheet = workbook.addWorksheet(name, { views: [{ showGridLines: false }] });
    writeSheet(sheet, name, dataset, reportee, profile);
  }
  return workbook.xlsx.writeBuffer();
}

function writeSheet(sheet: ExcelJS.Worksheet, name: string, dataset: WorkbenchDataset, reportee: Reportee, profile: ExportProfile): void {
  if (name === "Document_Summary") return writeDocumentSummary(sheet, dataset, reportee);
  if (/^KPI_\d{4}$/.test(name)) return writeKpi(sheet, name, dataset, reportee, profile);
  if (name === "OKR_Summary") return writeOkrSummary(sheet, dataset, reportee);
  if (name === "OKR_Checklist_Summary") return writeChecklistSummary(sheet, dataset, reportee);
  if (name.endsWith("_OKR_Checklist")) return writeChecklist(sheet, dataset, reportee);
  if (name === "Actual_vs_Achieved_Scorecard") return writeScorecard(sheet, dataset, reportee, profile);
  if (name === "Learning_Evidence") return writeLearning(sheet, dataset, reportee);
  if (name === "Ticket_Velocity") return writeVelocity(sheet, dataset, reportee);
  if (name === "Ticket_Spillover") return writeSpill(sheet, dataset, reportee);
  if (name === "FirstCut_Quality") return writeFirstCut(sheet, dataset, reportee);
  if (name === "CodeChange_Summary") return writeCodeSummary(sheet, dataset, reportee, profile);
  if (name === "CodeChange_Tickets") return writeCodeTickets(sheet, dataset, reportee);
  if (name === "Helpdesk_Discipline") return writeHelpdesk(sheet, dataset, reportee, profile);
  if (name === "SLA_CycleDays") return writeSla(sheet, dataset, reportee);
  if (name === "Customer_Defect_Themes") return writeDefects(sheet, dataset, reportee);
  if (name === "Rework_Reopen_Proxy") return writeRework(sheet, dataset, reportee);
  if (name.startsWith("Tickets_Master_")) return writeMaster(sheet, dataset, reportee);
  if (/^Q[1-4]-\d{4}_Tickets$/.test(name)) return writeQuarterTickets(sheet, name.replace(/_Tickets$/, ""), dataset, reportee);
  if (/^Q[1-4]-\d{4}_Ticket_Summary$/.test(name)) return writeQuarterSummary(sheet, name.replace(/_Ticket_Summary$/, ""), dataset, reportee);
  titleBlock(sheet, name, narrative(dataset, reportee.id, name));
}

function narrative(dataset: WorkbenchDataset, reporteeId: string, sheet: string): { title?: string; note?: string } {
  return dataset.sheetNarratives.find((item) => item.reporteeId === reporteeId && item.sheet === sheet) ?? {};
}

function titleBlock(sheet: ExcelJS.Worksheet, name: string, text: { title?: string; note?: string }, columns = 8): number {
  sheet.mergeCells(1, 1, 1, 2);
  linkCell(sheet.getCell(1, 1), `${name}!A1`, "Back to this sheet");
  sheet.getCell(3, 1).value = text.title ?? name;
  sheet.getCell(3, 1).font = { name: HEADER_FONT, bold: true, size: 14, color: { argb: NAVY } };
  sheet.mergeCells(3, 1, 3, columns);
  if (text.note) {
    sheet.getCell(4, 1).value = text.note;
    sheet.getCell(4, 1).alignment = { wrapText: true };
    sheet.mergeCells(4, 1, 4, columns);
    sheet.getRow(4).height = 32;
  }
  return 6;
}

function writeHeader(sheet: ExcelJS.Worksheet, rowNumber: number, headers: string[]): void {
  headers.forEach((header, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = header;
    cell.font = { name: HEADER_FONT, bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  sheet.views = [{ state: "frozen", ySplit: rowNumber, showGridLines: false }];
  sheet.autoFilter = { from: { row: rowNumber, column: 1 }, to: { row: rowNumber, column: headers.length } };
  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = Math.min(42, Math.max(14, header.length + 2));
  });
}

function linkCell(cell: ExcelJS.Cell, target: string, text?: string): void {
  const hyperlink = target.startsWith("http") ? target : `#'${target.split("!")[0]}'!${target.split("!")[1] ?? "A1"}`;
  cell.value = { text: text ?? target, hyperlink };
  cell.font = { name: HEADER_FONT, color: { argb: "FF0563C1" }, underline: true };
}

function writeText(cell: ExcelJS.Cell, value: string | number | null | undefined): void {
  if (value == null || value === "") return;
  cell.value = value;
  cell.alignment = { wrapText: true, vertical: "top" };
}

function writeDate(cell: ExcelJS.Cell, iso: string | undefined): void {
  if (!iso) return;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    cell.value = iso;
    return;
  }
  cell.value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  cell.numFmt = "yyyy-mm-dd";
}

function ticketsOf(dataset: WorkbenchDataset, reporteeId: string, quarterId?: string): Ticket[] {
  return dataset.tickets.filter((ticket) => ticket.reporteeId === reporteeId && (quarterId ? ticket.quarterId === quarterId : true));
}

function writeDocumentSummary(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").value = `${reportee.fullName} OKR checklist — document summary`;
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  writeHeader(sheet, 2, ["Version", "Area", "Change"]);
  const notes = dataset.documentNotes.filter((note) => note.reporteeId === reportee.id);
  notes.forEach((note, index) => {
    writeText(sheet.getCell(index + 3, 1), note.version);
    writeText(sheet.getCell(index + 3, 2), note.area);
    writeText(sheet.getCell(index + 3, 3), note.change);
  });
  sheet.getColumn(3).width = 88;
}

function writeKpi(sheet: ExcelJS.Worksheet, name: string, dataset: WorkbenchDataset, reportee: Reportee, profile: ExportProfile): void {
  const year = Number(name.split("_")[1]);
  const definitions = dataset.kpiDefinitions.filter((item) => item.reporteeId === reportee.id && item.year === year).sort((a, b) => a.displayOrder - b.displayOrder);
  const quarters = year === 2025 ? [3, 4] : [1, 2, 3, 4];
  const headers = ["KPI", "EmployeeID", "EmployeeName", "Weightage", "Year"];
  for (const quarter of quarters) headers.push(`Q${quarter}Target`, `Q${quarter}Actual`, `Q${quarter}Achieved`, "OKR Link");
  headers.push("Title");
  if (profile.kpiHasRmColumn) headers.push("RM");
  writeHeader(sheet, 1, headers);
  definitions.forEach((definition, index) => {
    const row = index + 2;
    writeText(sheet.getCell(row, 1), definition.sourceLabel);
    writeText(sheet.getCell(row, 2), reportee.employeeId);
    writeText(sheet.getCell(row, 3), reportee.fullName);
    const weightCell = sheet.getCell(row, 4);
    if (definition.weightFormula && definition.scopedWeight != null) {
      weightCell.value = { formula: definition.weightFormula.replace(/^=/, ""), result: definition.scopedWeight };
    } else if (definition.scopedWeight != null) weightCell.value = definition.scopedWeight;
    else if (definition.annualWeight != null) weightCell.value = definition.annualWeight;
    writeText(sheet.getCell(row, 5), year);
    quarters.forEach((quarter, quarterIndex) => {
      const quarterId = `q${quarter}-${year}`;
      const assessment = dataset.kpiAssessments.find((item) => item.kpiDefinitionId === definition.id && item.quarterId === quarterId);
      const start = 6 + quarterIndex * 4;
      writeText(sheet.getCell(row, start), assessment?.target);
      writeText(sheet.getCell(row, start + 1), assessment?.actual);
      if (assessment && assessment.status !== "pending") writeText(sheet.getCell(row, start + 2), assessment.status === "not_achieved" ? "No" : assessment.status === "not_applicable" ? "N/A" : "Yes");
      const checklist = dataset.okrChecklistEntries.find((item) => item.reporteeId === reportee.id && item.quarterId === quarterId && item.kpiAffected === definition.sourceLabel);
      if (checklist?.sourceRow) linkCell(sheet.getCell(row, start + 3), `${reportee.fullName}_OKR_Checklist!A${checklist.sourceRow}`);
    });
    writeText(sheet.getCell(row, headers.indexOf("Title") + 1), definition.title ?? reportee.role);
    if (profile.kpiHasRmColumn) writeText(sheet.getCell(row, headers.indexOf("RM") + 1), reportee.manager);
  });
  const totalRow = definitions.length + 3;
  sheet.getCell(totalRow, 1).value = year === 2025 ? "2 Quarter Sum (Expected)" : "Expected Score (2 Qtr)";
  const lastWeightRow = definitions.length + 1;
  if (lastWeightRow >= 2) {
    sheet.getCell(totalRow, 2).value = { formula: `SUM(D2:D${lastWeightRow})`, result: definitions.reduce((sum, item) => sum + (item.scopedWeight ?? item.annualWeight ?? 0), 0) };
  }
  sheet.getColumn(1).width = 36;
  for (let column = 6; column < headers.length; column += 4) sheet.getColumn(column).width = 48;
}

function writeChecklist(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Employee Name", "Quarter", "KPI Affected", "OKR Met?", "Weightage", "Artifacts to OKR", "Other Links", "OKRs", "Deliverable Expected", "Evidence Note"];
  writeHeader(sheet, 1, headers);
  const rows = dataset.okrChecklistEntries.filter((item) => item.reporteeId === reportee.id);
  rows.forEach((entry, index) => {
    const row = index + 2;
    const values = [entry.employeeName, entry.quarterId ? quarterLabel(entry.quarterId) : "", entry.kpiAffected, yesNo(entry.okrMet), entry.weightage, entry.artifacts, entry.otherLinks, entry.okrs, entry.deliverableExpected, entry.evidenceNote];
    values.forEach((value, column) => {
      const cell = sheet.getCell(row, column + 1);
      if ((column === 5 || column === 6) && typeof value === "string" && value.startsWith("http")) linkCell(cell, value);
      else if ((column === 5 || column === 6) && typeof value === "string" && value.includes("!")) linkCell(cell, value);
      else writeText(cell, value);
    });
    sheet.getRow(row).height = 48;
  });
  sheet.getColumn(8).width = 64;
  sheet.getColumn(9).width = 48;
  sheet.getColumn(10).width = 48;
}

function yesNo(status: string): string | null {
  if (status === "achieved" || status === "overridden") return "Yes";
  if (status === "not_achieved") return "No";
  if (status === "not_applicable") return "N/A";
  if (status === "insufficient_evidence") return null;
  return null;
}

function writeOkrSummary(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const quarters = ["q3-2025", "q4-2025", "q1-2026", "q2-2026"];
  sheet.getCell(1, 1).value = `${reportee.fullName} OKR weightage. Yes = full weight of that line. No = 0. Pending lines are omitted from the achieved total.`;
  writeHeader(sheet, 3, ["KPI / Met?", ...quarters.map(quarterLabel), "Grand Total"]);
  const kpis = unique(dataset.okrChecklistEntries.filter((item) => item.reporteeId === reportee.id).map((item) => item.kpiAffected));
  let row = 4;
  for (const kpi of kpis) {
    sheet.getCell(row, 1).value = kpi;
    row += 1;
    sheet.getCell(row, 1).value = "Yes";
    let total = 0;
    let any = false;
    quarters.forEach((quarterId, index) => {
      const lines = dataset.okrChecklistEntries.filter((item) => item.reporteeId === reportee.id && item.quarterId === quarterId && item.kpiAffected === kpi && item.okrMet === "achieved");
      if (lines.length === 0) return;
      const weight = lines.reduce((sum, line) => sum + (line.weightage ?? 0), 0);
      sheet.getCell(row, index + 2).value = weight;
      total += weight;
      any = true;
    });
    if (any) sheet.getCell(row, 6).value = total;
    row += 1;
    sheet.getCell(row, 1).value = "No";
    row += 1;
  }
}

function writeChecklistSummary(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  sheet.getCell(1, 1).value = `${reportee.fullName} OKR checklist summary. Yes takes the full line weight. No takes 0. Blank means not assessed.`;
  writeHeader(sheet, 3, ["Quarter / KPI", "No", "Yes", "Grand Total"]);
  const quarters = unique(dataset.okrChecklistEntries.filter((item) => item.reporteeId === reportee.id && item.quarterId).map((item) => item.quarterId));
  let row = 4;
  let totalNo = 0;
  let totalYes = 0;
  let totalPossible = 0;
  for (const quarterId of quarters) {
    const lines = dataset.okrChecklistEntries.filter((item) => item.reporteeId === reportee.id && item.quarterId === quarterId);
    const score = checklistScore(lines);
    sheet.getCell(row, 1).value = quarterLabel(quarterId);
    const no = lines.filter((line) => line.okrMet === "not_achieved").reduce((sum, line) => sum + (line.weightage ?? 0), 0);
    if (no) sheet.getCell(row, 2).value = no;
    if (score.achieved != null) sheet.getCell(row, 3).value = score.achieved;
    if (score.possible != null) sheet.getCell(row, 4).value = score.possible;
    totalNo += no;
    totalYes += score.achieved ?? 0;
    totalPossible += score.possible ?? 0;
    row += 1;
    for (const kpi of unique(lines.map((line) => line.kpiAffected))) {
      const subset = lines.filter((line) => line.kpiAffected === kpi);
      sheet.getCell(row, 1).value = `  ${kpi}`;
      const noWeight = subset.filter((line) => line.okrMet === "not_achieved").reduce((sum, line) => sum + (line.weightage ?? 0), 0);
      const yesWeight = subset.filter((line) => line.okrMet === "achieved").reduce((sum, line) => sum + (line.weightage ?? 0), 0);
      if (noWeight) sheet.getCell(row, 2).value = noWeight;
      if (subset.some((line) => line.okrMet === "achieved")) sheet.getCell(row, 3).value = yesWeight;
      const possible = subset.reduce((sum, line) => sum + (line.weightage ?? 0), 0);
      if (subset.some((line) => line.weightage != null)) sheet.getCell(row, 4).value = possible;
      row += 1;
    }
  }
  sheet.getCell(row, 1).value = "Grand Total";
  if (totalNo) sheet.getCell(row, 2).value = totalNo;
  if (quarters.length) {
    sheet.getCell(row, 3).value = totalYes;
    sheet.getCell(row, 4).value = totalPossible;
  }
}

function writeScorecard(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee, profile: ExportProfile): void {
  const headers = ["Quarter", "KPI Area", "Metric", "Target", "Actual", profile.scorecardHasSourceTargetColumn ? "Yes" : "Yes/No", "Weightage (KPI)", "Evidence Sheet"];
  if (profile.scorecardHasSourceTargetColumn) headers.push("Source KPI Target (short)", "Validation Notes");
  else headers.push("Notes");
  const block = titleBlock(sheet, "Actual_vs_Achieved_Scorecard", narrative(dataset, reportee.id, "Actual_vs_Achieved_Scorecard"), headers.length);
  writeHeader(sheet, block, headers);
  const lines = dataset.scorecardLines.filter((line) => line.reporteeId === reportee.id);
  lines.forEach((line, index) => {
    const row = block + 1 + index;
    const values: Array<string | number | null | undefined> = [quarterLabel(line.quarterId), line.kpiArea, line.metric, line.target, line.actual, yesNo(line.status), line.weightage, line.evidenceSheet];
    if (profile.scorecardHasSourceTargetColumn) values.push(line.sourceKpiTarget, line.validationNotes);
    else values.push(line.validationNotes);
    values.forEach((value, column) => writeText(sheet.getCell(row, column + 1), value));
  });
}

function writeLearning(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const sample = dataset.learningEvidence.find((item) => item.reporteeId === reportee.id);
  const rich = Boolean(sample?.problemStatement || sample?.acceptanceCriteria || sample?.techStack);
  const headers = rich
    ? ["Quarter", "KPI", "POC / Focus Area", "Problem Statement", "Acceptance Criteria", "Tech Stack", "Evidence Link / Path", "Achieved/Not Achieved", "Primary Deliverable", "Comments"]
    : ["Quarter", "KPI", "POC / Course", "Evidence Link / Path", "Yes/No"];
  const block = titleBlock(sheet, "Learning_Evidence", narrative(dataset, reportee.id, "Learning_Evidence"), headers.length);
  writeHeader(sheet, block, headers);
  dataset.learningEvidence.filter((item) => item.reporteeId === reportee.id).forEach((item, index) => {
    const row = block + 1 + index;
    const values = rich
      ? [item.quarterId ? quarterLabel(item.quarterId) : "", item.kpi, item.focusArea, item.problemStatement, item.acceptanceCriteria, item.techStack, item.evidenceLink, yesNo(item.status), item.primaryDeliverable, item.comments]
      : [item.quarterId ? quarterLabel(item.quarterId) : "", item.kpi, item.focusArea, item.evidenceLink, yesNo(item.status)];
    values.forEach((value, column) => {
      const cell = sheet.getCell(row, column + 1);
      if (typeof value === "string" && value.startsWith("http")) linkCell(cell, value);
      else writeText(cell, value);
    });
  });
}

function rule(dataset: WorkbenchDataset, reporteeId: string) {
  const found = dataset.assessmentRules.find((item) => item.reporteeId === reporteeId);
  if (!found) throw new Error(`Assessment rules are missing for ${reporteeId}.`);
  return found;
}

function quarterIds(dataset: WorkbenchDataset, reporteeId: string): string[] {
  return dataset.quarters.filter((quarter) => ticketsOf(dataset, reporteeId, quarter.id).length > 0).map((quarter) => quarter.id);
}

function writeVelocity(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Quarter", "Total Tickets", "Closed/Resolved", "Open", "Target", "Yes/No", "Comments", "Source"];
  const block = titleBlock(sheet, "Ticket_Velocity", narrative(dataset, reportee.id, "Ticket_Velocity"), headers.length);
  writeHeader(sheet, block, headers);
  const rules = rule(dataset, reportee.id);
  quarterIds(dataset, reportee.id).forEach((quarterId, index) => {
    const stats = summarizeTickets(ticketsForQuarter(dataset.tickets, reportee.id, quarterId), rules, quarterId);
    const target = rules.velocityTargets[quarterId] ?? null;
    const result = velocity(stats, rules, target);
    const snapshot = dataset.metricSnapshots.find((item) => item.reporteeId === reportee.id && item.sheet === "Ticket_Velocity" && item.quarterId === quarterId);
    const row = block + 1 + index;
    writeText(sheet.getCell(row, 1), quarterLabel(quarterId));
    sheet.getCell(row, 2).value = stats.total;
    sheet.getCell(row, 3).value = stats.closed;
    sheet.getCell(row, 4).value = stats.open;
    if (target != null) sheet.getCell(row, 5).value = target;
    writeText(sheet.getCell(row, 6), yesNo(snapshot?.status ?? result.status));
    writeText(sheet.getCell(row, 7), snapshot?.comment ?? result.detail);
    writeText(sheet.getCell(row, 8), `Tickets_Master_${reportee.fullName}`);
  });
}

function writeSpill(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Quarter", "Total", "Open (spill)", "Spill %", "Achieved/Not Achieved", "Open Ticket Nos.", "Comments"];
  const block = titleBlock(sheet, "Ticket_Spillover", narrative(dataset, reportee.id, "Ticket_Spillover"), headers.length);
  writeHeader(sheet, block, headers);
  const rules = rule(dataset, reportee.id);
  quarterIds(dataset, reportee.id).forEach((quarterId, index) => {
    const stats = summarizeTickets(ticketsForQuarter(dataset.tickets, reportee.id, quarterId), rules, quarterId);
    const result = spillover(stats, rules);
    const snapshot = dataset.metricSnapshots.find((item) => item.reporteeId === reportee.id && item.sheet === "Ticket_Spillover" && item.quarterId === quarterId);
    if (!snapshot && result.status === "not_applicable") return;
    const row = block + 1 + index;
    writeText(sheet.getCell(row, 1), quarterLabel(quarterId));
    sheet.getCell(row, 2).value = stats.total;
    sheet.getCell(row, 3).value = stats.open;
    if (result.actual != null) sheet.getCell(row, 4).value = result.actual;
    writeText(sheet.getCell(row, 5), yesNo(snapshot?.status ?? result.status));
    writeText(sheet.getCell(row, 6), stats.openTicketNos.join(", ") || "-");
    writeText(sheet.getCell(row, 7), snapshot?.comment ?? "Achieved if open<=2 or spill%<=20");
  });
}

function writeFirstCut(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Quarter", "Code/SP Tickets", "Closed Code/SP", "Code Lines", "SQL Lines", "Achieved/Not Achieved", "Comments"];
  const block = titleBlock(sheet, "FirstCut_Quality", narrative(dataset, reportee.id, "FirstCut_Quality"), headers.length);
  writeHeader(sheet, block, headers);
  const rules = rule(dataset, reportee.id);
  quarterIds(dataset, reportee.id).forEach((quarterId, index) => {
    const tickets = ticketsForQuarter(dataset.tickets, reportee.id, quarterId).filter((ticket) => truthy(ticket.codeChange) || truthy(ticket.spChange));
    const stats = summarizeTickets(tickets, rules, quarterId);
    const snapshot = dataset.metricSnapshots.find((item) => item.reporteeId === reportee.id && item.sheet === "FirstCut_Quality" && item.quarterId === quarterId);
    const row = block + 1 + index;
    writeText(sheet.getCell(row, 1), quarterLabel(quarterId));
    sheet.getCell(row, 2).value = stats.total;
    sheet.getCell(row, 3).value = stats.closed;
    if (stats.codeLines != null) sheet.getCell(row, 4).value = stats.codeLines;
    if (stats.sqlLines != null) sheet.getCell(row, 5).value = stats.sqlLines;
    writeText(sheet.getCell(row, 6), yesNo(snapshot?.status ?? "pending"));
    writeText(sheet.getCell(row, 7), snapshot?.comment ?? "Proxy only. A line count does not by itself mark quality achieved.");
  });
}

function truthy(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "yes";
}

function writeCodeSummary(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee, profile: ExportProfile): void {
  const headers = ["Quarter", "Code Change Tickets", "SP Change Tickets", "Code Lines", "SQL Lines", "Achieved/Not Achieved", "Comments"];
  if (profile.codeChangeHasPrColumns) headers.push("PR Rejection %", "PR Rejection Achieved");
  const block = titleBlock(sheet, "CodeChange_Summary", narrative(dataset, reportee.id, "CodeChange_Summary"), headers.length);
  writeHeader(sheet, block, headers);
  const rules = rule(dataset, reportee.id);
  quarterIds(dataset, reportee.id).forEach((quarterId, index) => {
    const stats = summarizeTickets(ticketsForQuarter(dataset.tickets, reportee.id, quarterId), rules, quarterId);
    const snapshot = dataset.metricSnapshots.find((item) => item.reporteeId === reportee.id && item.sheet === "CodeChange_Summary" && item.quarterId === quarterId);
    const row = block + 1 + index;
    writeText(sheet.getCell(row, 1), quarterLabel(quarterId));
    sheet.getCell(row, 2).value = stats.codeChange;
    sheet.getCell(row, 3).value = stats.spChange;
    if (stats.codeLines != null) sheet.getCell(row, 4).value = stats.codeLines;
    if (stats.sqlLines != null) sheet.getCell(row, 5).value = stats.sqlLines;
    writeText(sheet.getCell(row, 6), yesNo(snapshot?.status ?? "pending"));
    writeText(sheet.getCell(row, 7), snapshot?.comment);
    if (profile.codeChangeHasPrColumns) {
      const rejection = snapshot?.values["PR Rejection %"];
      if (rejection != null && rejection !== "") sheet.getCell(row, 8).value = Number(rejection);
      writeText(sheet.getCell(row, 9), snapshot?.values["PR Rejection Achieved"]);
    }
  });
}

const TICKET_HEADERS = ["Ticket No.", "Description", "Status", "Month", "Assign Date", "Closure Date", "Owner", "SP Change", "Code Change", "Code Lines Changed", "SQL Lines Changed", "Quarter", "Cycle Days"];

function writeTicketRow(sheet: ExcelJS.Worksheet, rowNumber: number, ticket: Ticket): void {
  writeText(sheet.getCell(rowNumber, 1), ticket.ticketNo);
  writeText(sheet.getCell(rowNumber, 2), ticket.description);
  writeText(sheet.getCell(rowNumber, 3), ticket.status);
  writeDate(sheet.getCell(rowNumber, 4), ticket.month);
  writeDate(sheet.getCell(rowNumber, 5), ticket.assignDate);
  writeDate(sheet.getCell(rowNumber, 6), ticket.closureDate);
  writeText(sheet.getCell(rowNumber, 7), ticket.owner);
  writeText(sheet.getCell(rowNumber, 8), ticket.spChange);
  writeText(sheet.getCell(rowNumber, 9), ticket.codeChange);
  if (ticket.codeLines != null) sheet.getCell(rowNumber, 10).value = ticket.codeLines;
  if (ticket.sqlLines != null) sheet.getCell(rowNumber, 11).value = ticket.sqlLines;
  writeText(sheet.getCell(rowNumber, 12), ticket.quarterId ? quarterLabel(ticket.quarterId) : undefined);
  if (ticket.cycleDays != null) sheet.getCell(rowNumber, 13).value = ticket.cycleDays;
}

function writeMaster(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const block = titleBlock(sheet, `Tickets_Master_${reportee.fullName}`, narrative(dataset, reportee.id, `Tickets_Master_${reportee.fullName}`) ?? {}, 13);
  const stored = narrative(dataset, reportee.id, dataset.exportProfiles.find((item) => item.reporteeId === reportee.id)?.masterSheetName ?? "");
  if (stored.title) sheet.getCell(3, 1).value = stored.title;
  writeHeader(sheet, block, TICKET_HEADERS);
  ticketsOf(dataset, reportee.id).forEach((ticket, index) => writeTicketRow(sheet, block + 1 + index, ticket));
  sheet.getColumn(2).width = 56;
}

function writeQuarterTickets(sheet: ExcelJS.Worksheet, label: string, dataset: WorkbenchDataset, reportee: Reportee): void {
  const quarter = dataset.quarters.find((item) => item.label === label);
  const block = titleBlock(sheet, `${label}_Tickets`, { title: `${label} — ticket evidence pack`, note: "Derived from the ticket master. The same ticket is not stored twice." }, 13);
  writeHeader(sheet, block, TICKET_HEADERS);
  if (!quarter) return;
  ticketsOf(dataset, reportee.id, quarter.id).forEach((ticket, index) => writeTicketRow(sheet, block + 1 + index, ticket));
}

function writeQuarterSummary(sheet: ExcelJS.Worksheet, label: string, dataset: WorkbenchDataset, reportee: Reportee): void {
  const quarter = dataset.quarters.find((item) => item.label === label);
  titleBlock(sheet, `${label}_Ticket_Summary`, { title: `${label} Summary` }, 3);
  writeHeader(sheet, 5, ["Metric", "Value", "Yes/No"]);
  if (!quarter) return;
  const rules = rule(dataset, reportee.id);
  const stats = summarizeTickets(ticketsOf(dataset, reportee.id, quarter.id), rules, quarter.id);
  const rows: Array<[string, number | string | null, string | null]> = [
    ["Total tickets", stats.total, null],
    ["Closed/Resolved", stats.closed, null],
    ["Open / spill", stats.open, null],
    ["Spill %", spillover(stats, rules).actual, yesNo(spillover(stats, rules).status)],
    ["Code Change tickets", stats.codeChange, null],
    ["SP Change tickets", stats.spChange, null],
    ["Code Lines", stats.codeLines, null],
    ["SQL Lines", stats.sqlLines, null],
  ];
  rows.forEach((entry, index) => {
    writeText(sheet.getCell(6 + index, 1), entry[0]);
    if (entry[1] != null) sheet.getCell(6 + index, 2).value = entry[1];
    writeText(sheet.getCell(6 + index, 3), entry[2]);
  });
}

function writeCodeTickets(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Ticket No.", "Description", "Status", "Quarter", "Code Change", "SP Change", "Code Lines", "SQL Lines", "Assign Date", "Closure Date", "Azure_PR_URL (manual)"];
  const block = titleBlock(sheet, "CodeChange_Tickets", narrative(dataset, reportee.id, "CodeChange_Tickets"), headers.length);
  writeHeader(sheet, block, headers);
  ticketsOf(dataset, reportee.id)
    .filter((ticket) => truthy(ticket.codeChange) || truthy(ticket.spChange))
    .forEach((ticket, index) => {
      const row = block + 1 + index;
      writeText(sheet.getCell(row, 1), ticket.ticketNo);
      writeText(sheet.getCell(row, 2), ticket.description);
      writeText(sheet.getCell(row, 3), ticket.status);
      writeText(sheet.getCell(row, 4), ticket.quarterId ? quarterLabel(ticket.quarterId) : undefined);
      writeText(sheet.getCell(row, 5), ticket.codeChange);
      writeText(sheet.getCell(row, 6), ticket.spChange);
      if (ticket.codeLines != null) sheet.getCell(row, 7).value = ticket.codeLines;
      if (ticket.sqlLines != null) sheet.getCell(row, 8).value = ticket.sqlLines;
      writeDate(sheet.getCell(row, 9), ticket.assignDate);
      writeDate(sheet.getCell(row, 10), ticket.closureDate);
      if (ticket.azurePrUrl) linkCell(sheet.getCell(row, 11), ticket.azurePrUrl);
    });
}

function writeHelpdesk(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee, profile: ExportProfile): void {
  const assessment = dataset.processAssessments.find((item) => item.reporteeId === reportee.id);
  const block = titleBlock(sheet, "Helpdesk_Discipline", narrative(dataset, reportee.id, "Helpdesk_Discipline"), 8);
  sheet.getCell(block, 1).value = "1) Process Checklist — items measured for Process Adherance";
  const headers = profile.helpdeskHasProcessItemColumn
    ? ["Measure #", "Process Item", "What is measured", "Evidence / How checked", "Source", "Target"]
    : ["Measure #", "What is measured", "Evidence / How checked", "Source", "Target"];
  writeHeader(sheet, block + 1, headers);
  (assessment?.checklistItems ?? []).forEach((item, index) => {
    const values = profile.helpdeskHasProcessItemColumn
      ? [item.measureNo, item.processItem, item.whatIsMeasured, item.evidence, item.source, item.target]
      : [item.measureNo, item.whatIsMeasured, item.evidence, item.source, item.target];
    values.forEach((value, column) => writeText(sheet.getCell(block + 2 + index, column + 1), value));
  });
}

function writeSla(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Quarter", "Closed", "Avg Cycle Days", "Max Cycle Days", "Achieved/Not Achieved", "Comments"];
  const block = titleBlock(sheet, "SLA_CycleDays", narrative(dataset, reportee.id, "SLA_CycleDays"), headers.length);
  writeHeader(sheet, block, headers);
  const rules = rule(dataset, reportee.id);
  quarterIds(dataset, reportee.id).forEach((quarterId, index) => {
    const stats = summarizeTickets(ticketsForQuarter(dataset.tickets, reportee.id, quarterId), rules, quarterId);
    const snapshot = dataset.metricSnapshots.find((item) => item.reporteeId === reportee.id && item.sheet === "SLA_CycleDays" && item.quarterId === quarterId);
    const row = block + 1 + index;
    const average = stats.cycleDays.length ? Math.round((stats.cycleDays.reduce((sum, value) => sum + value, 0) / stats.cycleDays.length) * 10) / 10 : null;
    writeText(sheet.getCell(row, 1), quarterLabel(quarterId));
    sheet.getCell(row, 2).value = stats.closed;
    if (average != null) sheet.getCell(row, 3).value = average;
    if (stats.cycleDays.length) sheet.getCell(row, 4).value = Math.max(...stats.cycleDays);
    writeText(sheet.getCell(row, 5), yesNo(snapshot?.status ?? "pending"));
    writeText(sheet.getCell(row, 6), snapshot?.comment ?? "Proxy threshold 45 days. Recorded assessment is kept when it differs from the calculation.");
  });
}

function writeDefects(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Quarter", "Closed", "Defect-like Themes", "Yes/No", "Ticket Nos.", "Comments"];
  const block = titleBlock(sheet, "Customer_Defect_Themes", narrative(dataset, reportee.id, "Customer_Defect_Themes"), headers.length);
  writeHeader(sheet, block, headers);
  const rules = rule(dataset, reportee.id);
  let row = block + 1;
  for (const quarterId of quarterIds(dataset, reportee.id)) {
    const stats = summarizeTickets(ticketsForQuarter(dataset.tickets, reportee.id, quarterId), rules, quarterId);
    const flagged = stats.tickets.filter((ticket) => ticket.defectLike === true);
    const snapshot = dataset.metricSnapshots.find((item) => item.reporteeId === reportee.id && item.sheet === "Customer_Defect_Themes" && item.quarterId === quarterId);
    if (!snapshot && flagged.length === 0 && stats.closed === 0) continue;
    writeText(sheet.getCell(row, 1), quarterLabel(quarterId));
    sheet.getCell(row, 2).value = stats.closed;
    sheet.getCell(row, 3).value = flagged.length;
    writeText(sheet.getCell(row, 4), yesNo(snapshot?.status ?? (flagged.length <= rules.defect.maxThemes ? "achieved" : "not_achieved")));
    writeText(sheet.getCell(row, 5), flagged.map((ticket) => ticket.ticketNo).join(", ") || "-");
    writeText(sheet.getCell(row, 6), snapshot?.comment);
    row += 1;
  }
}

function writeRework(sheet: ExcelJS.Worksheet, dataset: WorkbenchDataset, reportee: Reportee): void {
  const headers = ["Quarter", "Tickets", "Rework Proxy Count", "Rate %", "Yes/No", "Ticket Nos."];
  const block = titleBlock(sheet, "Rework_Reopen_Proxy", narrative(dataset, reportee.id, "Rework_Reopen_Proxy"), headers.length);
  writeHeader(sheet, block, headers);
  quarterIds(dataset, reportee.id).forEach((quarterId, index) => {
    const snapshot = dataset.metricSnapshots.find((item) => item.reporteeId === reportee.id && item.sheet === "Rework_Reopen_Proxy" && item.quarterId === quarterId);
    const row = block + 1 + index;
    writeText(sheet.getCell(row, 1), quarterLabel(quarterId));
    writeText(sheet.getCell(row, 2), snapshot?.values.Tickets ?? snapshot?.values["Tickets"]);
    writeText(sheet.getCell(row, 3), snapshot?.values["Rework Proxy Count"]);
    writeText(sheet.getCell(row, 4), snapshot?.values["Rate %"]);
    writeText(sheet.getCell(row, 5), yesNo(snapshot?.status ?? "pending"));
    writeText(sheet.getCell(row, 6), snapshot?.values["Ticket Nos."]);
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
