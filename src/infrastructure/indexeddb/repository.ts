import Dexie, { type Table } from "dexie";
import { migrateDataset } from "@/domain/schema";
import type { AuditEntry, WorkbenchDataset } from "@/domain/types";
import { emptyDataset, nowIso } from "@/infrastructure/excel/dataset";

export interface StoredDocument {
  id: "dataset";
  dataset: WorkbenchDataset;
}

export interface UndoRecord {
  id: string;
  at: string;
  label: string;
  dataset: WorkbenchDataset;
}

export class PmsDatabase extends Dexie {
  documents!: Table<StoredDocument, string>;
  undo!: Table<UndoRecord, string>;

  constructor(name = "pms-workbench") {
    super(name);
    this.version(1).stores({
      documents: "id",
      undo: "id, at",
    });
  }
}

export class DatasetRepository {
  constructor(private readonly db: PmsDatabase) {}

  async load(): Promise<WorkbenchDataset | null> {
    const row = await this.db.documents.get("dataset");
    return row?.dataset ?? null;
  }

  async save(dataset: WorkbenchDataset, undoLabel?: string): Promise<void> {
    const current = await this.load();
    if (undoLabel && current) {
      await this.db.undo.put({ id: crypto.randomUUID(), at: nowIso(), label: undoLabel, dataset: current });
      const history = await this.db.undo.orderBy("at").toArray();
      const extra = history.length - 20;
      if (extra > 0) await this.db.undo.bulkDelete(history.slice(0, extra).map((item) => item.id));
    }
    const next = { ...dataset, application: { ...dataset.application, revision: dataset.application.revision + 1, updatedAt: nowIso() } };
    await this.db.documents.put({ id: "dataset", dataset: next });
  }

  async replace(dataset: WorkbenchDataset): Promise<void> {
    await this.db.transaction("rw", this.db.documents, async () => {
      await this.db.documents.put({ id: "dataset", dataset });
    });
  }

  async undo(): Promise<WorkbenchDataset | null> {
    const history = await this.db.undo.orderBy("at").reverse().toArray();
    const latest = history[0];
    if (!latest) return null;
    await this.db.documents.put({ id: "dataset", dataset: latest.dataset });
    await this.db.undo.delete(latest.id);
    return latest.dataset;
  }

  async listUndo(): Promise<Array<{ id: string; at: string; label: string }>> {
    const rows = await this.db.undo.orderBy("at").reverse().toArray();
    return rows.map(({ id, at, label }) => ({ id, at, label }));
  }
}

export function withAudit(dataset: WorkbenchDataset, entry: Omit<AuditEntry, "id" | "at">): WorkbenchDataset {
  const audit: AuditEntry = { ...entry, id: crypto.randomUUID(), at: nowIso() };
  return { ...dataset, auditHistory: [audit, ...dataset.auditHistory].slice(0, 500) };
}

function sameSeedSources(left: string[] | undefined, right: string[] | undefined): boolean {
  const a = [...(left ?? [])].sort();
  const b = [...(right ?? [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Loads IndexedDB when present. Replace that copy when the bundled seed names
 * a different workbook list, or when the bundled revision is newer, so a
 * rebuilt seed shows up on reload.
 */
export async function seedIfEmpty(repository: DatasetRepository, loadSeed: () => Promise<WorkbenchDataset>): Promise<WorkbenchDataset> {
  const seeded = await loadSeed();
  const existing = await repository.load();
  if (existing) {
    const checked = migrateDataset(existing);
    if (!checked.ok) throw new Error(checked.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" "));
    const sameFiles = sameSeedSources(checked.dataset.application.seededFrom, seeded.application.seededFrom);
    const storedRevision = checked.dataset.application.revision;
    if (sameFiles && storedRevision >= seeded.application.revision) return checked.dataset;
  }
  await repository.replace(seeded);
  return seeded;
}

export { emptyDataset };
