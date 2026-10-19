import "fake-indexeddb/auto";
import { addReportee } from "@/domain/mutations";
import { emptyDataset } from "@/infrastructure/excel/dataset";
import { DatasetRepository, PmsDatabase } from "@/infrastructure/indexeddb/repository";
import { migrateDataset } from "@/domain/schema";

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
});
