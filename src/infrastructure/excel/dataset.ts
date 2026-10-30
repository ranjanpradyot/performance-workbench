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

const OWNED_KEYS = [
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
] as const;

type OwnedKey = (typeof OWNED_KEYS)[number];
type OwnedRow = { id: string; reporteeId: string };

function ownedRows(dataset: WorkbenchDataset, key: OwnedKey): OwnedRow[] {
  return dataset[key] as OwnedRow[];
}

function findIncomingReportee(currentName: string, targetId: string, incoming: WorkbenchDataset) {
  const byId = incoming.reportees.find((person) => person.id === targetId);
  if (byId) return byId;
  const name = currentName.trim().toLowerCase();
  return incoming.reportees.find((person) => person.fullName.trim().toLowerCase() === name);
}

/** Dataset containing one reportee plus the shared years and quarters. */
export function sliceReportee(dataset: WorkbenchDataset, reporteeId: string): WorkbenchDataset {
  const person = dataset.reportees.find((item) => item.id === reporteeId);
  if (!person) throw new Error("That reportee is not in this workbook.");
  const slice = emptyDataset();
  const stamp = nowIso();
  slice.application = {
    ...dataset.application,
    createdAt: stamp,
    updatedAt: stamp,
    seededFrom: dataset.application.seededFrom.filter((file) => file.toLowerCase().includes(person.fullName.toLowerCase())),
  };
  slice.reportees = [structuredClone(person)];
  slice.appraisalYears = structuredClone(dataset.appraisalYears);
  slice.quarters = structuredClone(dataset.quarters);
  for (const key of OWNED_KEYS) {
    const kept = structuredClone(ownedRows(dataset, key).filter((row) => row.reporteeId === reporteeId));
    Object.assign(slice, { [key]: kept });
  }
  return slice;
}

/**
 * Replaces one reportee's records and leaves every other reportee in place.
 * The existing id, colour, and status are kept so the rest of the desk does not shift.
 */
export function replaceReportee(current: WorkbenchDataset, incoming: WorkbenchDataset, targetId: string): WorkbenchDataset {
  const target = current.reportees.find((person) => person.id === targetId);
  if (!target) throw new Error("That reportee is not in this workbook.");
  const source = findIncomingReportee(target.fullName, targetId, incoming);
  if (!source) throw new Error(`This file does not contain ${target.fullName}.`);
  const next = structuredClone(current);
  for (const key of OWNED_KEYS) {
    Object.assign(next, { [key]: ownedRows(next, key).filter((row) => row.reporteeId !== targetId) });
  }
  next.reportees = next.reportees.filter((person) => person.id !== targetId);
  next.reportees.push({ ...structuredClone(source), id: targetId, themeColor: target.themeColor, status: target.status });
  for (const key of OWNED_KEYS) {
    for (const row of ownedRows(incoming, key)) {
      if (row.reporteeId !== source.id && row.reporteeId !== targetId) continue;
      const adopted = { ...structuredClone(row), id: row.id.split(source.id).join(targetId), reporteeId: targetId };
      const collection = ownedRows(next, key);
      if (!collection.some((item) => item.id === adopted.id)) collection.push(adopted);
    }
  }
  for (const quarter of incoming.quarters) {
    if (!next.quarters.some((item) => item.id === quarter.id)) next.quarters.push(structuredClone(quarter));
  }
  for (const year of incoming.appraisalYears) upsertYear(next, year.year);
  next.quarters.sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber);
  next.application.updatedAt = nowIso();
  next.application.revision = current.application.revision;
  return next;
}
