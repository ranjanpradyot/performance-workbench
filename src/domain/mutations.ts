import { quarterBounds, slug } from "@/domain/status";
import type { KpiAssessment, KpiDefinition, LearningEvidence, OkrChecklistEntry, QuarterStatus, Reportee, Ticket, WorkbenchDataset } from "@/domain/types";
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

export function upsertChecklist(dataset: WorkbenchDataset, entry: OkrChecklistEntry): WorkbenchDataset {
  if (!entry.okrs.trim()) throw new Error("The OKR text is required.");
  if (entry.weightage != null && Number.isNaN(entry.weightage)) throw new Error("Weightage must be a number.");
  const exists = dataset.okrChecklistEntries.some((item) => item.id === entry.id);
  const rows = exists ? dataset.okrChecklistEntries.map((item) => (item.id === entry.id ? entry : item)) : [...dataset.okrChecklistEntries, entry];
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
