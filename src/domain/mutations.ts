import { quarterBounds, quarterLabel, slug } from "@/domain/status";
import type { AchievementStatus, KpiAssessment, KpiDefinition, LearningEvidence, OkrChecklistEntry, Quarter, QuarterStatus, Reportee, ScoreModel, Ticket, WorkbenchDataset } from "@/domain/types";
import { touchQuarter, upsertYear } from "@/infrastructure/excel/dataset";
import { withAudit } from "@/infrastructure/indexeddb/repository";

function now(): string {
  return new Date().toISOString();
}

export interface ReporteeInput {
  fullName: string;
  employeeId?: string;
  role?: string;
  team?: string;
  manager?: string;
  joiningDate?: string;
  themeColor: string;
  notes?: string;
}

export function validateReportee(dataset: WorkbenchDataset, input: ReporteeInput, currentId?: string): string | null {
  if (!input.fullName.trim()) return "Full name is required.";
  if (input.employeeId) {
    const conflict = dataset.reportees.find((item) => item.employeeId === input.employeeId && item.id !== currentId);
    if (conflict) return `Employee ID ${input.employeeId} is already used by ${conflict.fullName}. Change the ID or edit that reportee.`;
  }
  if (input.joiningDate && Number.isNaN(Date.parse(input.joiningDate))) return "Joining date is not a valid date.";
  return null;
}

export function addReportee(dataset: WorkbenchDataset, input: ReporteeInput): WorkbenchDataset {
  const error = validateReportee(dataset, input);
  if (error) throw new Error(error);
  const timestamp = now();
  const reportee: Reportee = {
    id: `rep_${slug(input.fullName)}_${crypto.randomUUID().slice(0, 8)}`,
    fullName: input.fullName.trim(),
    employeeId: input.employeeId?.trim() || undefined,
    role: input.role?.trim() || undefined,
    team: input.team?.trim() || undefined,
    manager: input.manager?.trim() || undefined,
    joiningDate: input.joiningDate || undefined,
    status: "active",
    themeColor: input.themeColor,
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const rules = defaultRules(reportee.id, timestamp);
  const profile = {
    id: `profile_${reportee.id}`,
    reporteeId: reportee.id,
    checklistSheetName: `${reportee.fullName}_OKR_Checklist`,
    masterSheetName: `Tickets_Master_${reportee.fullName}`,
    includeDocumentSummary: true,
    learningPosition: "before_velocity" as const,
    codeChangeHasPrColumns: true,
    helpdeskHasProcessItemColumn: false,
    kpiHasRmColumn: false,
    scorecardHasSourceTargetColumn: true,
    sheetOrder: standardSheetOrder(reportee.fullName),
  };
  return withAudit(
    {
      ...dataset,
      reportees: [...dataset.reportees, reportee],
      assessmentRules: [...dataset.assessmentRules, rules],
      exportProfiles: [...dataset.exportProfiles, profile],
    },
    { entityType: "reportee", recordId: reportee.id, operation: "create", after: reportee },
  );
}

export function updateReportee(dataset: WorkbenchDataset, id: string, input: ReporteeInput): WorkbenchDataset {
  const error = validateReportee(dataset, input, id);
  if (error) throw new Error(error);
  const current = dataset.reportees.find((item) => item.id === id);
  if (!current) throw new Error("That reportee no longer exists.");
  const next = { ...current, ...input, fullName: input.fullName.trim(), employeeId: input.employeeId?.trim() || undefined, updatedAt: now() };
  return withAudit(
    { ...dataset, reportees: dataset.reportees.map((item) => (item.id === id ? next : item)) },
    { entityType: "reportee", recordId: id, operation: "update", before: current, after: next },
  );
}

export function setReporteeStatus(dataset: WorkbenchDataset, id: string, status: Reportee["status"], reason: string): WorkbenchDataset {
  const current = dataset.reportees.find((item) => item.id === id);
  if (!current) throw new Error("That reportee no longer exists.");
  const next = { ...current, status, updatedAt: now() };
  return withAudit(
    { ...dataset, reportees: dataset.reportees.map((item) => (item.id === id ? next : item)) },
    { entityType: "reportee", recordId: id, operation: status === "archived" ? "archive" : "restore", before: current, after: next, reason },
  );
}

export function createQuarter(dataset: WorkbenchDataset, year: number, quarterNumber: number, reporteeIds: string[], notes?: string): WorkbenchDataset {
  if (quarterNumber < 1 || quarterNumber > 4) throw new Error("Quarter number must be 1, 2, 3, or 4.");
  const id = `q${quarterNumber}-${year}`;
  if (dataset.quarters.some((item) => item.id === id)) throw new Error(`${`Q${quarterNumber}-${year}`} already exists. Select it instead of creating a duplicate.`);
  const next = structuredClone(dataset);
  upsertYear(next, year);
  const bounds = quarterBounds(year, quarterNumber);
  const timestamp = now();
  next.quarters.push({
    id,
    label: `Q${quarterNumber}-${year}`,
    year,
    quarterNumber,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    status: "planning",
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  next.quarters.sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber);
  for (const reporteeId of reporteeIds) {
    const definitions = next.kpiDefinitions.filter((item) => item.reporteeId === reporteeId && item.active);
    const template = definitions.filter((item) => item.year === year);
    const source = template.length ? template : definitions.filter((item) => item.year === year - 1);
    for (const definition of source) {
      let targetDefinition = definition;
      if (definition.year !== year) {
        const copy: KpiDefinition = { ...definition, id: `kpi_${reporteeId}_${year}_${definition.id.split("_").slice(3).join("_") || crypto.randomUUID().slice(0, 6)}`, year, scopedWeight: definition.annualWeight != null ? definition.annualWeight / 4 : null };
        if (!next.kpiDefinitions.some((item) => item.id === copy.id)) next.kpiDefinitions.push(copy);
        targetDefinition = next.kpiDefinitions.find((item) => item.id === copy.id) ?? copy;
      }
      const assessment: KpiAssessment = {
        id: `kpa_${reporteeId}_${id}_${targetDefinition.id}`,
        reporteeId,
        quarterId: id,
        kpiDefinitionId: targetDefinition.id,
        status: "pending",
        recordedStatus: "pending",
        weightUsed: targetDefinition.annualWeight != null ? targetDefinition.annualWeight / 4 : null,
        evidenceRefs: [],
        manualOverride: false,
        inheritedTemplate: true,
        updatedAt: timestamp,
      };
      if (!next.kpiAssessments.some((item) => item.id === assessment.id)) next.kpiAssessments.push(assessment);
    }
  }
  return withAudit(next, { entityType: "quarter", recordId: id, operation: "create", after: { year, quarterNumber, reporteeIds }, reason: notes });
}

export function setQuarterStatus(dataset: WorkbenchDataset, id: string, status: QuarterStatus, reason: string): WorkbenchDataset {
  const current = dataset.quarters.find((item) => item.id === id);
  if (!current) throw new Error("That quarter was not found.");
  if (current.status === "finalized" && status !== "finalized" && !reason.trim()) {
    throw new Error("Reopening a finalized quarter needs a reason. It is stored in the audit history.");
  }
  const next = { ...current, status, updatedAt: now() };
  return withAudit(
    { ...dataset, quarters: dataset.quarters.map((item) => (item.id === id ? next : item)) },
    { entityType: "quarter", recordId: id, operation: status === "finalized" ? "finalize" : "reopen", before: current, after: next, reason },
  );
}

/** Annual KPI pointers, and the pointers on one OKR quarter, cannot total more than this. */
export const POINTER_CAP = 100;

export interface KpiInput {
  name: string;
  category: string;
  pointers: number;
  description?: string;
  startQuarterId: string;
}

export function annualPointersUsed(dataset: WorkbenchDataset, reporteeId: string, year: number, excludeDefinitionId?: string): number {
  return roundPointers(dataset.kpiDefinitions
    .filter((item) => item.reporteeId === reporteeId && item.year === year && item.active && item.id !== excludeDefinitionId)
    .reduce((sum, item) => sum + (item.annualWeight ?? 0), 0));
}

export function quarterOkrPointersUsed(dataset: WorkbenchDataset, reporteeId: string, quarterId: string, excludeEntryId?: string): number {
  return roundPointers(dataset.okrChecklistEntries
    .filter((item) => item.reporteeId === reporteeId && item.quarterId === quarterId && item.id !== excludeEntryId && item.okrMet !== "not_applicable")
    .reduce((sum, item) => sum + (item.weightage ?? 0), 0));
}

/** First quarter in the KPI year that is still in scope. Earlier rows are not applicable. */
export function kpiStartQuarterId(dataset: WorkbenchDataset, definitionId: string): string {
  const definition = dataset.kpiDefinitions.find((item) => item.id === definitionId);
  if (!definition) return "";
  const mine = dataset.kpiAssessments.filter((item) => item.kpiDefinitionId === definitionId);
  const inScope = dataset.quarters
    .filter((quarter) => quarter.year === definition.year && mine.some((item) => item.quarterId === quarter.id && item.status !== "not_applicable"))
    .sort(byQuarter);
  if (inScope[0]) return inScope[0].id;
  const any = dataset.quarters.filter((quarter) => quarter.year === definition.year && mine.some((item) => item.quarterId === quarter.id)).sort(byQuarter);
  return any[0]?.id ?? "";
}

export function addKpi(dataset: WorkbenchDataset, reporteeId: string, input: KpiInput): WorkbenchDataset {
  const next = structuredClone(dataset);
  const definition = buildDefinition(next, reporteeId, input);
  next.kpiDefinitions.push(definition);
  writeAssessments(next, definition, input.startQuarterId, true);
  return withAudit(next, { entityType: "kpi", recordId: definition.id, operation: "create", after: definition });
}

export function updateKpi(dataset: WorkbenchDataset, definitionId: string, input: KpiInput): WorkbenchDataset {
  const current = dataset.kpiDefinitions.find((item) => item.id === definitionId);
  if (!current) throw new Error("That KPI no longer exists.");
  const next = structuredClone(dataset);
  const definition = buildDefinition(next, current.reporteeId, input, current);
  next.kpiDefinitions = next.kpiDefinitions.map((item) => (item.id === definitionId ? definition : item));
  writeAssessments(next, definition, input.startQuarterId, false);
  return withAudit(next, { entityType: "kpi", recordId: definitionId, operation: "update", before: current, after: definition });
}

export function removeKpi(dataset: WorkbenchDataset, definitionId: string): WorkbenchDataset {
  const current = dataset.kpiDefinitions.find((item) => item.id === definitionId);
  if (!current) return dataset;
  const removed = dataset.kpiAssessments.filter((item) => item.kpiDefinitionId === definitionId);
  return withAudit(
    {
      ...dataset,
      kpiDefinitions: dataset.kpiDefinitions.filter((item) => item.id !== definitionId),
      kpiAssessments: dataset.kpiAssessments.filter((item) => item.kpiDefinitionId !== definitionId),
    },
    { entityType: "kpi", recordId: definitionId, operation: "delete", before: { definition: current, assessments: removed }, reason: "Deleted from the KPI list after confirmation. OKR checklist lines are kept." },
  );
}

export function upsertChecklist(dataset: WorkbenchDataset, entry: OkrChecklistEntry, options?: { markEarlierQuartersNotApplicable?: boolean }): WorkbenchDataset {
  if (!entry.okrs.trim()) throw new Error("The OKR text is required.");
  assertPointerValue(entry.weightage, "Pointers");
  if (entry.okrMet !== "not_applicable") {
    const total = quarterOkrPointersUsed(dataset, entry.reporteeId, entry.quarterId, entry.id) + (entry.weightage ?? 0);
    assertPointerTotal(total, `OKR pointers for ${quarterLabel(entry.quarterId)}`);
  }
  const exists = dataset.okrChecklistEntries.some((item) => item.id === entry.id);
  let rows = exists ? dataset.okrChecklistEntries.map((item) => (item.id === entry.id ? entry : item)) : [...dataset.okrChecklistEntries, entry];
  if (options?.markEarlierQuartersNotApplicable && !exists) {
    const quarter = dataset.quarters.find((item) => item.id === entry.quarterId);
    const earlier = quarter ? dataset.quarters.filter((item) => item.year === quarter.year && item.quarterNumber < quarter.quarterNumber) : [];
    const timestamp = now();
    for (const past of earlier) {
      const already = rows.some((item) => item.reporteeId === entry.reporteeId && item.quarterId === past.id && item.okrs.trim() === entry.okrs.trim() && item.kpiAffected === entry.kpiAffected);
      if (already) continue;
      rows = [...rows, { ...entry, id: `okr_${entry.reporteeId}_${past.id}_${crypto.randomUUID().slice(0, 8)}`, quarterId: past.id, okrMet: "not_applicable", weightage: null, updatedAt: timestamp }];
    }
  }
  return withAudit({ ...dataset, okrChecklistEntries: rows }, { entityType: "okr", recordId: entry.id, operation: exists ? "update" : "create", after: entry });
}

export function removeTicket(dataset: WorkbenchDataset, id: string): WorkbenchDataset {
  const current = dataset.tickets.find((item) => item.id === id);
  if (!current) return dataset;
  return withAudit(
    { ...dataset, tickets: dataset.tickets.filter((item) => item.id !== id) },
    { entityType: "ticket", recordId: id, operation: "delete", before: current, reason: "Removed from the ticket master after confirmation. Quarterly views are derived from the master." },
  );
}

export function removeChecklist(dataset: WorkbenchDataset, id: string): WorkbenchDataset {
  const current = dataset.okrChecklistEntries.find((item) => item.id === id);
  if (!current) return dataset;
  return withAudit(
    { ...dataset, okrChecklistEntries: dataset.okrChecklistEntries.filter((item) => item.id !== id) },
    { entityType: "okr", recordId: id, operation: "delete", before: current, reason: "Deleted from the checklist after confirmation." },
  );
}

export function upsertTicket(dataset: WorkbenchDataset, ticket: Ticket): WorkbenchDataset {
  if (!ticket.ticketNo.trim()) throw new Error("Ticket number is required.");
  const duplicate = dataset.tickets.find((item) => item.reporteeId === ticket.reporteeId && item.ticketNo === ticket.ticketNo && item.quarterId === ticket.quarterId && item.id !== ticket.id);
  if (duplicate) throw new Error(`Ticket ${ticket.ticketNo} already exists for this reportee in this quarter. Open the existing ticket instead of adding a duplicate.`);
  if (ticket.assignDate && Number.isNaN(Date.parse(ticket.assignDate))) throw new Error("Assign date is not a valid date.");
  if (ticket.closureDate && Number.isNaN(Date.parse(ticket.closureDate))) throw new Error("Closure date is not a valid date.");
  for (const [label, value] of [["Code lines", ticket.codeLines], ["SQL lines", ticket.sqlLines], ["Cycle days", ticket.cycleDays]] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0)) throw new Error(`${label} must be a number that is zero or greater. Leave it blank when it is unknown.`);
  }
  const exists = dataset.tickets.some((item) => item.id === ticket.id);
  const rows = exists ? dataset.tickets.map((item) => (item.id === ticket.id ? ticket : item)) : [...dataset.tickets, ticket];
  return withAudit({ ...dataset, tickets: rows }, { entityType: "ticket", recordId: ticket.id, operation: exists ? "update" : "create", after: { ticketNo: ticket.ticketNo, quarterId: ticket.quarterId } });
}

export function upsertLearning(dataset: WorkbenchDataset, item: LearningEvidence): WorkbenchDataset {
  if (!item.focusArea?.trim()) throw new Error("A focus area or POC name is required. Text in the evidence fields does not mark the item achieved.");
  const exists = dataset.learningEvidence.some((row) => row.id === item.id);
  const rows = exists ? dataset.learningEvidence.map((row) => (row.id === item.id ? item : row)) : [...dataset.learningEvidence, item];
  return withAudit({ ...dataset, learningEvidence: rows }, { entityType: "learning", recordId: item.id, operation: exists ? "update" : "create", after: item });
}

export function overrideAssessment(dataset: WorkbenchDataset, id: string, status: KpiAssessment["status"], reason: string): WorkbenchDataset {
  if (!reason.trim()) throw new Error("An override reason is required. The calculated result is kept.");
  const current = dataset.kpiAssessments.find((item) => item.id === id);
  if (!current) throw new Error("That assessment was not found.");
  const next: KpiAssessment = { ...current, status, manualOverride: true, overrideReason: reason.trim(), calculatedStatus: current.calculatedStatus ?? current.recordedStatus, updatedAt: now() };
  return withAudit(
    { ...dataset, kpiAssessments: dataset.kpiAssessments.map((item) => (item.id === id ? next : item)) },
    { entityType: "kpiAssessment", recordId: id, operation: "override", before: current, after: next, reason },
  );
}

function roundPointers(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertPointerValue(value: number | null, label: string): void {
  if (value == null) return;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be zero or greater. Leave it blank when it is unknown. Blank is not stored as zero.`);
  if (value > POINTER_CAP) throw new Error(`${label} cannot exceed ${POINTER_CAP}.`);
}

function assertPointerTotal(total: number, scope: string): void {
  if (total > POINTER_CAP + 0.001) {
    const shown = Number.isInteger(roundPointers(total)) ? String(roundPointers(total)) : roundPointers(total).toFixed(1);
    throw new Error(`${scope} would total ${shown} pointers. The total cannot exceed ${POINTER_CAP}.`);
  }
}

function byQuarter(left: Quarter, right: Quarter): number {
  return left.year - right.year || left.quarterNumber - right.quarterNumber;
}

function quarterPointer(annual: number, model: ScoreModel | undefined): number {
  return model === "full_annual_each_quarter" ? roundPointers(annual) : roundPointers(annual / 4);
}

function buildDefinition(dataset: WorkbenchDataset, reporteeId: string, input: KpiInput, current?: KpiDefinition): KpiDefinition {
  if (!dataset.reportees.some((item) => item.id === reporteeId)) throw new Error("That reportee no longer exists.");
  const name = input.name.trim();
  if (!name) throw new Error("KPI name is required.");
  const category = input.category.trim();
  if (!category) throw new Error("Category is required.");
  if (!Number.isFinite(input.pointers)) throw new Error("Pointers are required.");
  assertPointerValue(input.pointers, "Pointers");
  const start = dataset.quarters.find((item) => item.id === input.startQuarterId);
  if (!start) throw new Error("Choose the quarter this KPI starts in.");
  const duplicate = dataset.kpiDefinitions.find((item) => item.reporteeId === reporteeId && item.year === start.year && item.active && item.id !== current?.id && item.sourceLabel.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) throw new Error(`${name} already exists for ${start.year}. Edit that KPI instead of adding a duplicate.`);
  const total = annualPointersUsed(dataset, reporteeId, start.year, current?.id) + input.pointers;
  assertPointerTotal(total, `KPI pointers for ${start.year}`);
  const rules = dataset.assessmentRules.find((item) => item.reporteeId === reporteeId);
  const pointers = roundPointers(input.pointers);
  const scopedWeight = current && current.annualWeight === pointers
    ? current.scopedWeight
    : rules?.scoreModel === "full_annual_each_quarter"
      ? pointers
      : roundPointers(pointers / 2);
  return {
    id: current?.id ?? `kpi_${reporteeId}_${start.year}_${slug(name) || "kpi"}_${crypto.randomUUID().slice(0, 6)}`,
    reporteeId,
    year: start.year,
    name,
    sourceLabel: name,
    category,
    description: input.description?.trim() || undefined,
    annualWeight: pointers,
    scopedWeight,
    weightFormula: current?.weightFormula,
    assessmentMethod: current?.assessmentMethod ?? "Manager Yes/No. Yes awards the quarter pointers. No awards 0. Earlier quarters are not applicable and are not scored as zero.",
    active: true,
    displayOrder: current?.displayOrder ?? nextDisplayOrder(dataset, reporteeId, start.year),
    title: current?.title,
    extension: current?.extension,
  };
}

function isBefore(quarter: Quarter, start: Quarter): boolean {
  return quarter.year < start.year || (quarter.year === start.year && quarter.quarterNumber < start.quarterNumber);
}

function nextDisplayOrder(dataset: WorkbenchDataset, reporteeId: string, year: number): number {
  const orders = dataset.kpiDefinitions.filter((item) => item.reporteeId === reporteeId && item.year === year).map((item) => item.displayOrder);
  return orders.length ? Math.max(...orders) + 1 : 1;
}

function writeAssessments(dataset: WorkbenchDataset, definition: KpiDefinition, startQuarterId: string, createMissingPast: boolean): void {
  const start = dataset.quarters.find((item) => item.id === startQuarterId);
  if (!start) return;
  const rules = dataset.assessmentRules.find((item) => item.reporteeId === definition.reporteeId);
  const weight = quarterPointer(definition.annualWeight ?? 0, rules?.scoreModel);
  const timestamp = now();
  for (const quarter of dataset.quarters.filter((item) => item.year === start.year).sort(byQuarter)) {
    const existing = dataset.kpiAssessments.find((item) => item.kpiDefinitionId === definition.id && item.quarterId === quarter.id);
    const before = isBefore(quarter, start);
    if (before && !existing && !createMissingPast) continue;
    const decided = existing != null && existing.status !== "pending" && existing.status !== "not_applicable";
    let nextStatus: AchievementStatus = "pending";
    if (before) nextStatus = decided ? existing.status : "not_applicable";
    else if (existing && existing.status !== "not_applicable") nextStatus = existing.status;
    const nextWeight = nextStatus === "not_applicable" ? null : weight;
    const assessment: KpiAssessment = {
      id: existing?.id ?? `kpa_${definition.reporteeId}_${quarter.id}_${definition.id}`,
      reporteeId: definition.reporteeId,
      quarterId: quarter.id,
      kpiDefinitionId: definition.id,
      target: existing?.target,
      actual: existing?.actual,
      status: nextStatus,
      recordedStatus: nextStatus === "not_applicable" ? "not_applicable" : existing?.recordedStatus && existing.recordedStatus !== "not_applicable" ? existing.recordedStatus : nextStatus,
      weightUsed: nextWeight,
      notes: existing?.notes,
      evidenceRefs: existing?.evidenceRefs ?? [],
      assessedAt: existing?.assessedAt,
      manualOverride: existing?.manualOverride ?? false,
      overrideReason: existing?.overrideReason,
      calculatedStatus: existing?.calculatedStatus,
      inheritedTemplate: existing?.inheritedTemplate ?? true,
      updatedAt: timestamp,
    };
    if (existing) dataset.kpiAssessments = dataset.kpiAssessments.map((item) => (item.id === existing.id ? assessment : item));
    else dataset.kpiAssessments.push(assessment);
  }
}

function defaultRules(reporteeId: string, timestamp: string) {
  return {
    id: `rule_${reporteeId}`,
    reporteeId,
    version: 1,
    scoreModel: "scoped_quarter_weight" as const,
    inScopeQuarterIds: ["q3-2025", "q4-2025", "q1-2026", "q2-2026"],
    closedStatuses: ["Closed", "Resolved", "RESOLVED"],
    quarterAssignment: "workbook_quarter_authoritative" as const,
    quarterAssignmentNote: "New tickets use Closure Date, else Month, else Assign Date.",
    velocity: { thresholdRatio: 0.7, useFloor: true, trainingQuarterIds: [] as string[] },
    velocityTargets: {} as Record<string, number | null>,
    spill: { maxOpen: 2, maxSpillPercent: 20, combiner: "or" as const },
    sla: { maxAverageCycleDays: 45 },
    defect: { maxThemes: 4, keywordSuggestion: ["error", "incorrect", "bug", "duplicate", "missing"] },
    rework: { maxRatePercent: 5, countWaitStates: false, keywords: ["rework", "reopen", "re-open"] },
    prRejectionMaxPercent: 10,
    processMinPercent: 90,
    notes: ["New reportees use the scoped quarter-weight rule: annual weight / 4, Yes = full quarter weight, No = 0."],
    updatedAt: timestamp,
  };
}

function standardSheetOrder(name: string): string[] {
  return [
    "Document_Summary",
    "KPI_2025",
    "KPI_2026",
    "OKR_Summary",
    "OKR_Checklist_Summary",
    `${name}_OKR_Checklist`,
    "Actual_vs_Achieved_Scorecard",
    "Learning_Evidence",
    "Ticket_Velocity",
    "Ticket_Spillover",
    "FirstCut_Quality",
    "CodeChange_Summary",
    "CodeChange_Tickets",
    "Helpdesk_Discipline",
    "SLA_CycleDays",
    "Customer_Defect_Themes",
    "Rework_Reopen_Proxy",
    `Tickets_Master_${name}`,
  ];
}

export function ensureQuarter(dataset: WorkbenchDataset, label: string): WorkbenchDataset {
  const match = /^Q([1-4])-(\d{4})$/.exec(label);
  if (!match) throw new Error("Use a quarter label such as Q3-2026.");
  touchQuarter(dataset, Number(match[2]), Number(match[1]));
  return dataset;
}
