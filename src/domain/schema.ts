import { z } from "zod";
import { SCHEMA_VERSION, type WorkbenchDataset } from "./types";

const status = z.enum(["achieved", "not_achieved", "pending", "not_applicable", "insufficient_evidence", "overridden"]);

export const reporteeSchema = z.looseObject({
  id: z.string().min(1),
  employeeId: z.string().min(1).optional(),
  fullName: z.string().min(1),
  status: z.enum(["active", "inactive", "archived"]),
  themeColor: z.string().min(4),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const quarterSchema = z.looseObject({
  id: z.string().regex(/^q[1-4]-\d{4}$/),
  label: z.string(),
  year: z.number().int(),
  quarterNumber: z.number().int().min(1).max(4),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["planning", "in_progress", "under_review", "finalized", "archived"]),
});

export const datasetSchema = z.looseObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  application: z.looseObject({
    name: z.literal("PMS Workbench"),
    revision: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    seededFrom: z.array(z.string()),
  }),
  reportees: z.array(reporteeSchema),
  appraisalYears: z.array(z.looseObject({ id: z.string(), year: z.number(), label: z.string() })),
  quarters: z.array(quarterSchema),
  kpiDefinitions: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), name: z.string(), year: z.number() })),
  kpiAssessments: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), quarterId: z.string(), status })),
  okrChecklistEntries: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), okrs: z.string() })),
  tickets: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), ticketNo: z.string() })),
  learningEvidence: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), status })),
  processAssessments: z.array(z.looseObject({ id: z.string(), reporteeId: z.string() })),
  scorecardLines: z.array(z.looseObject({ id: z.string(), reporteeId: z.string() })),
  metricSnapshots: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), sheet: z.string() })),
  documentNotes: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), change: z.string() })),
  sheetNarratives: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), sheet: z.string() })),
  supportingLinks: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), target: z.string() })),
  assessmentRules: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), version: z.number() })),
  exportProfiles: z.array(z.looseObject({ id: z.string(), reporteeId: z.string(), sheetOrder: z.array(z.string()) })),
  auditHistory: z.array(z.looseObject({ id: z.string(), at: z.string(), entityType: z.string(), recordId: z.string(), operation: z.string() })),
});

export interface SchemaIssue {
  path: string;
  message: string;
}

export function validateDataset(input: unknown): { ok: true; dataset: WorkbenchDataset } | { ok: false; issues: SchemaIssue[] } {
  const parsed = datasetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "dataset",
        message: issue.message,
      })),
    };
  }
  const dataset = parsed.data as unknown as WorkbenchDataset;
  const issues: SchemaIssue[] = [];
  const ids = new Set<string>();
  for (const reportee of dataset.reportees) {
    if (ids.has(reportee.id)) issues.push({ path: "reportees", message: `Duplicate reportee id ${reportee.id}.` });
    ids.add(reportee.id);
    if (reportee.employeeId && dataset.reportees.some((other) => other.id !== reportee.id && other.employeeId === reportee.employeeId)) {
      issues.push({ path: "reportees.employeeId", message: `Employee ID ${reportee.employeeId} is used by more than one reportee.` });
    }
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, dataset };
}

export function migrateDataset(input: unknown): { ok: true; dataset: WorkbenchDataset } | { ok: false; issues: SchemaIssue[] } {
  if (!input || typeof input !== "object") {
    return { ok: false, issues: [{ path: "dataset", message: "The file is not a JSON object. Choose a PMS Workbench backup." }] };
  }
  const version = "schemaVersion" in input ? Number((input as { schemaVersion?: unknown }).schemaVersion) : NaN;
  if (!Number.isFinite(version)) {
    return { ok: false, issues: [{ path: "schemaVersion", message: "schemaVersion is missing. This file is not a PMS Workbench backup." }] };
  }
  if (version > SCHEMA_VERSION) {
    return { ok: false, issues: [{ path: "schemaVersion", message: `This backup uses schema ${version}. This application supports schema ${SCHEMA_VERSION}. Open it with a newer PMS Workbench build.` }] };
  }
  if (version < SCHEMA_VERSION) {
    return { ok: false, issues: [{ path: "schemaVersion", message: `Schema ${version} has no migration path to schema ${SCHEMA_VERSION}.` }] };
  }
  return validateDataset(input);
}
