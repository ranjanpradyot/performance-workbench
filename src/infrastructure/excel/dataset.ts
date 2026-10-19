import { quarterBounds, quarterLabel } from "@/domain/status";
import { SCHEMA_VERSION, type AppraisalYear, type Quarter, type QuarterStatus, type WorkbenchDataset } from "@/domain/types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function emptyDataset(): WorkbenchDataset {
  const timestamp = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    application: {
      name: "PMS Workbench",
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      seededFrom: [],
    },
    reportees: [],
    appraisalYears: [],
    quarters: [],
    kpiDefinitions: [],
    kpiAssessments: [],
    okrChecklistEntries: [],
    tickets: [],
    learningEvidence: [],
    processAssessments: [],
    scorecardLines: [],
    metricSnapshots: [],
    documentNotes: [],
    sheetNarratives: [],
    supportingLinks: [],
    assessmentRules: [],
    exportProfiles: [],
    auditHistory: [],
  };
}

export function upsertYear(dataset: WorkbenchDataset, year: number): AppraisalYear {
  const existing = dataset.appraisalYears.find((item) => item.year === year);
  if (existing) return existing;
  const created: AppraisalYear = { id: `y${year}`, year, label: String(year) };
  dataset.appraisalYears.push(created);
  dataset.appraisalYears.sort((a, b) => a.year - b.year);
  return created;
}

export function defaultQuarterStatus(year: number, quarterNumber: number): QuarterStatus {
  const key = year * 10 + quarterNumber;
  if (key >= 20253 && key <= 20262) return "under_review";
  if (key < 20253) return "archived";
  return "planning";
}

export function touchQuarter(dataset: WorkbenchDataset, year: number, quarterNumber: number, status?: QuarterStatus): Quarter {
  upsertYear(dataset, year);
  const id = `q${quarterNumber}-${year}`;
  const existing = dataset.quarters.find((item) => item.id === id);
  if (existing) return existing;
  const bounds = quarterBounds(year, quarterNumber);
  const timestamp = nowIso();
  const created: Quarter = {
    id,
    label: quarterLabel(id),
    year,
    quarterNumber,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    status: status ?? defaultQuarterStatus(year, quarterNumber),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  dataset.quarters.push(created);
  dataset.quarters.sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber);
  return created;
}

export function mergeDatasets(parts: WorkbenchDataset[]): WorkbenchDataset {
  const merged = emptyDataset();
  for (const part of parts) {
    merged.application.seededFrom.push(...part.application.seededFrom);
    for (const year of part.appraisalYears) upsertYear(merged, year.year);
    for (const quarter of part.quarters) {
      if (!merged.quarters.some((item) => item.id === quarter.id)) merged.quarters.push(quarter);
    }
    const lists = [
      "reportees",
      "kpiDefinitions",
      "kpiAssessments",
      "okrChecklistEntries",
      "tickets",
      "learningEvidence",
      "processAssessments",
      "scorecardLines",
      "metricSnapshots",
      "documentNotes",
      "sheetNarratives",
      "supportingLinks",
      "assessmentRules",
      "exportProfiles",
      "auditHistory",
    ] as const;
    for (const key of lists) {
      for (const row of part[key]) {
        const collection = merged[key] as Array<{ id: string }>;
        if (!collection.some((item) => item.id === row.id)) collection.push(row as never);
      }
    }
  }
  merged.quarters.sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber);
  merged.application.revision = 1;
  merged.application.updatedAt = nowIso();
  return merged;
}
