/** Canonical PMS Workbench dataset. Schema version 1. */

export const SCHEMA_VERSION = 1 as const;

export type AchievementStatus =
  | "achieved"
  | "not_achieved"
  | "pending"
  | "not_applicable"
  | "insufficient_evidence"
  | "overridden";

export type ReporteeStatus = "active" | "inactive" | "archived";

export type QuarterStatus = "planning" | "in_progress" | "under_review" | "finalized" | "archived";

export type ScoreModel = "scoped_quarter_weight" | "full_annual_each_quarter";

export interface AppMeta {
  name: "PMS Workbench";
  revision: number;
  createdAt: string;
  updatedAt: string;
  seededFrom: string[];
  lastBackupAt?: string;
  lastFileSyncAt?: string;
  fileSyncRevision?: number;
}

export interface Reportee {
  id: string;
  employeeId?: string;
  fullName: string;
  role?: string;
  team?: string;
  manager?: string;
  joiningDate?: string;
  status: ReporteeStatus;
  themeColor: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppraisalYear {
  id: string;
  year: number;
  label: string;
}

export interface Quarter {
  id: string;
  label: string;
  year: number;
  quarterNumber: number;
  startDate: string;
  endDate: string;
  status: QuarterStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KpiDefinition {
  id: string;
  reporteeId: string;
  year: number;
  name: string;
  /** Original workbook label, including source spelling such as "Process Adherance". */
  sourceLabel: string;
  category: string;
  description?: string;
  annualWeight: number | null;
  /** Weight shown in the KPI sheet for the in-scope period. Null when the cell was blank. */
  scopedWeight: number | null;
  weightFormula?: string;
  measurementUnit?: string;
  assessmentMethod?: string;
  active: boolean;
  displayOrder: number;
  title?: string;
  extension?: Record<string, string>;
}

export interface KpiQuarterTarget {
  quarterId: string;
  target?: string;
}

export interface KpiAssessment {
  id: string;
  reporteeId: string;
  quarterId: string;
  kpiDefinitionId: string;
  target?: string;
  actual?: string;
  status: AchievementStatus;
  /** Workbook value before any in-app override. */
  recordedStatus: AchievementStatus;
  /** Weight awarded for this quarter when status is achieved. Null means not scored. */
  weightUsed: number | null;
  notes?: string;
  evidenceRefs: string[];
  assessedAt?: string;
  manualOverride: boolean;
  overrideReason?: string;
  calculatedStatus?: AchievementStatus;
  inheritedTemplate: boolean;
  updatedAt: string;
}

export interface OkrChecklistEntry {
  id: string;
  reporteeId: string;
  quarterId: string;
  employeeName: string;
  kpiAffected: string;
  okrMet: AchievementStatus;
  weightage: number | null;
  artifacts?: string;
  otherLinks?: string;
  okrs: string;
  deliverableExpected?: string;
  evidenceNote?: string;
  sourceRow?: number;
  kpiDefinitionId?: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  reporteeId: string;
  ticketNo: string;
  description?: string;
  status?: string;
  month?: string;
  assignDate?: string;
  closureDate?: string;
  owner?: string;
  spChange?: string;
  codeChange?: string;
  codeLines: number | null;
  sqlLines: number | null;
  /** Quarter label as stored in the workbook. Authoritative for historical rows. */
  quarterId?: string;
  cycleDays: number | null;
  defectLike?: boolean | null;
  azurePrUrl?: string;
  sourceSheet?: string;
  extension?: Record<string, string>;
  updatedAt: string;
}

export interface LearningEvidence {
  id: string;
  reporteeId: string;
  quarterId: string;
  kpi?: string;
  focusArea?: string;
  problemStatement?: string;
  acceptanceCriteria?: string;
  techStack?: string;
  evidenceLink?: string;
  status: AchievementStatus;
  primaryDeliverable?: string;
  comments?: string;
  extension?: Record<string, string>;
  updatedAt: string;
}

export interface ProcessChecklistItem {
  measureNo?: string;
  processItem?: string;
  whatIsMeasured?: string;
  evidence?: string;
  source?: string;
  target?: string;
}

export interface ProcessScorecell {
  item: string;
  byQuarter: Record<string, AchievementStatus | "missing">;
  overall?: AchievementStatus;
  comments?: string;
}

export interface ProcessAssessment {
  id: string;
  reporteeId: string;
  narrative?: string;
  checklistItems: ProcessChecklistItem[];
  scorecard: ProcessScorecell[];
  overallStatus: AchievementStatus;
  overallComment?: string;
  updatedAt: string;
}

export interface ScorecardLine {
  id: string;
  reporteeId: string;
  quarterId: string;
  kpiArea: string;
  metric: string;
  target?: string;
  actual?: string;
  status: AchievementStatus;
  weightage: number | null;
  evidenceSheet?: string;
  sourceKpiTarget?: string;
  validationNotes?: string;
  isQuarterTotal: boolean;
}

export interface MetricSnapshot {
  id: string;
  reporteeId: string;
  sheet: string;
  quarterId?: string;
  values: Record<string, string>;
  status?: AchievementStatus;
  comment?: string;
}

export interface DocumentNote {
  id: string;
  reporteeId: string;
  version?: string;
  area?: string;
  change: string;
}

export interface SheetNarrative {
  id: string;
  reporteeId: string;
  sheet: string;
  title?: string;
  note?: string;
  order: number;
}

export interface SupportingLink {
  id: string;
  reporteeId: string;
  quarterId?: string;
  label: string;
  target: string;
  kind: "internal" | "external" | "workbook";
  source?: string;
}

export interface VelocityRule {
  /** Achieved when closed >= target OR closed >= floor(target * thresholdRatio). */
  thresholdRatio: number;
  useFloor: boolean;
  /** Quarter labels whose recorded Yes is a training/PM override even if the count misses the target. */
  trainingQuarterIds: string[];
}

export interface SpillRule {
  maxOpen: number;
  maxSpillPercent: number;
  /** Achieved when open <= maxOpen OR spill% <= maxSpillPercent. */
  combiner: "or" | "and";
}

export interface SlaRule {
  maxAverageCycleDays: number;
}

export interface DefectRule {
  maxThemes: number;
  /** Curated flags are authoritative. Keywords are suggestions only. */
  keywordSuggestion: string[];
}

export interface ReworkRule {
  maxRatePercent: number;
  /** When true, OnHold / In-UAT / Approver count as rework. Krishna's note includes them. Utkarsh excludes them. */
  countWaitStates: boolean;
  keywords: string[];
}

export interface AssessmentRuleSet {
  id: string;
  reporteeId: string;
  version: number;
  scoreModel: ScoreModel;
  /** Quarters that participate in the scoped weight (annual/4 * count). */
  inScopeQuarterIds: string[];
  closedStatuses: string[];
  quarterAssignment: "workbook_quarter_authoritative";
  quarterAssignmentNote: string;
  velocity: VelocityRule;
  /** Per-quarter closed-ticket target. Null means the workbook showed an em dash or blank, not zero. */
  velocityTargets: Record<string, number | null>;
  spill: SpillRule;
  sla: SlaRule;
  defect: DefectRule;
  rework: ReworkRule;
  prRejectionMaxPercent: number;
  processMinPercent: number;
  notes: string[];
  updatedAt: string;
}

export interface ExportProfile {
  id: string;
  reporteeId: string;
  checklistSheetName: string;
  masterSheetName: string;
  includeDocumentSummary: boolean;
  learningPosition: "before_velocity" | "before_master";
  codeChangeHasPrColumns: boolean;
  helpdeskHasProcessItemColumn: boolean;
  kpiHasRmColumn: boolean;
  scorecardHasSourceTargetColumn: boolean;
  sheetOrder: string[];
}

export interface AuditEntry {
  id: string;
  at: string;
  entityType: string;
  recordId: string;
  operation: "create" | "update" | "delete" | "archive" | "restore" | "import" | "override" | "finalize" | "reopen";
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export interface WorkbenchDataset {
  schemaVersion: typeof SCHEMA_VERSION;
  application: AppMeta;
  reportees: Reportee[];
  appraisalYears: AppraisalYear[];
  quarters: Quarter[];
  kpiDefinitions: KpiDefinition[];
  kpiAssessments: KpiAssessment[];
  okrChecklistEntries: OkrChecklistEntry[];
  tickets: Ticket[];
  learningEvidence: LearningEvidence[];
  processAssessments: ProcessAssessment[];
  scorecardLines: ScorecardLine[];
  metricSnapshots: MetricSnapshot[];
  documentNotes: DocumentNote[];
  sheetNarratives: SheetNarrative[];
  supportingLinks: SupportingLink[];
  assessmentRules: AssessmentRuleSet[];
  exportProfiles: ExportProfile[];
  auditHistory: AuditEntry[];
}

export interface ImportIssue {
  sheet?: string;
  row?: number;
  column?: string;
  value?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportPreview {
  fileName: string;
  sheetNames: string[];
  reporteeName?: string;
  additions: Record<string, number>;
  updates: Record<string, number>;
  issues: ImportIssue[];
  dataset: WorkbenchDataset;
}
