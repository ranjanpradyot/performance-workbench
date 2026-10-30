import "fake-indexeddb/auto";
import { addReportee } from "@/domain/mutations";
import { emptyDataset } from "@/infrastructure/excel/dataset";
import { DatasetRepository, PmsDatabase, seedIfEmpty } from "@/infrastructure/indexeddb/repository";
import { migrateDataset } from "@/domain/schema";
import type { WorkbenchDataset } from "@/domain/types";

describe("local persistence", () => {
  it("saves a reportee and reads it back", async () => {
    const repository = new DatasetRepository(new PmsDatabase("pms-test-save"));
    const dataset = addReportee(emptyDataset(), { fullName: "New Person", themeColor: "#1F4E79", employeeId: "42" });
    await repository.replace(dataset);
    const loaded = await repository.load();
    expect(loaded?.reportees[0]?.fullName).toBe("New Person");
    expect(loaded?.reportees[0]?.employeeId).toBe("42");
  });

  it("rejects a duplicate employee id before save", () => {
    const dataset = addReportee(emptyDataset(), { fullName: "First", themeColor: "#1F4E79", employeeId: "1775" });
    expect(() => addReportee(dataset, { fullName: "Second", themeColor: "#0F6E56", employeeId: "1775" })).toThrow(/1775/);
  });

  it("restores a JSON backup and rejects a newer schema", () => {
    const dataset = emptyDataset();
    const restored = migrateDataset(dataset);
    expect(restored.ok).toBe(true);
    const future = migrateDataset({ ...dataset, schemaVersion: 99 });
    expect(future.ok).toBe(false);
  });

  it("undoes the last saved edit", async () => {
    const repository = new DatasetRepository(new PmsDatabase("pms-test-undo"));
    const initial = emptyDataset();
    await repository.replace(initial);
    const next = addReportee(initial, { fullName: "Undo Me", themeColor: "#1F4E79" });
    await repository.save(next, "add");
    const undone = await repository.undo();
    expect(undone?.reportees).toHaveLength(0);
  });

  it("replaces IndexedDB when the bundled seed workbook list changes", async () => {
    const repository = new DatasetRepository(new PmsDatabase("pms-test-reseed"));
    const oldSeed: WorkbenchDataset = {
      ...emptyDataset(),
      application: {
        ...emptyDataset().application,
        seededFrom: ["Utkarsh_OKR_Checklist_Linked_0.3.xlsx", "Krishna_OKR_Checklist_Linked_0.3.xlsx"],
      },
      tickets: [],
    };
    await repository.replace(oldSeed);
    const newSeed: WorkbenchDataset = {
      ...emptyDataset(),
      application: {
        ...emptyDataset().application,
        seededFrom: ["Utkarsh_OKR_Checklist_Linked_0.4.xlsx", "Krishna_OKR_Checklist_Linked_0.4.xlsx"],
      },
      tickets: [
        {
          id: "tkt_rep_utkarsh_42241",
          reporteeId: "rep_utkarsh",
          ticketNo: "42241",
          codeLines: 169,
          sqlLines: null,
          cycleDays: null,
          quarterId: "q3-2026",
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    const loaded = await seedIfEmpty(repository, async () => newSeed);
    expect(loaded.application.seededFrom).toEqual(newSeed.application.seededFrom);
    expect(loaded.tickets).toHaveLength(1);
    expect(loaded.tickets[0]?.ticketNo).toBe("42241");
  });

  it("replaces IndexedDB when the bundled seed revision is newer", async () => {
    const repository = new DatasetRepository(new PmsDatabase("pms-test-reseed-revision"));
    const stored: WorkbenchDataset = {
      ...emptyDataset(),
      application: { ...emptyDataset().application, revision: 2, seededFrom: ["Santosh_OKR_Checklist_Linked_0.4.xlsx"] },
    };
    await repository.replace(stored);
    const newer: WorkbenchDataset = {
      ...emptyDataset(),
      application: { ...emptyDataset().application, revision: 3, seededFrom: ["Santosh_OKR_Checklist_Linked_0.4.xlsx"] },
      tickets: [
        {
          id: "tkt_rep_santosh_45359",
          reporteeId: "rep_santosh",
          ticketNo: "45359",
          codeLines: null,
          sqlLines: null,
          cycleDays: null,
          quarterId: "q3-2026",
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    const loaded = await seedIfEmpty(repository, async () => newer);
    expect(loaded.application.revision).toBe(3);
    expect(loaded.tickets[0]?.ticketNo).toBe("45359");
  });
});
