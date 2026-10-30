import { emptyDataset, touchQuarter } from "@/infrastructure/excel/dataset";
import { addKpi, annualPointersUsed, removeKpi, updateKpi, upsertChecklist } from "@/domain/mutations";
import type { OkrChecklistEntry, Reportee, WorkbenchDataset } from "@/domain/types";

function fixture(): WorkbenchDataset {
  const dataset = emptyDataset();
  const person: Reportee = {
    id: "rep",
    fullName: "Asha Rao",
    status: "active",
    themeColor: "#004FCC",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  dataset.reportees.push(person);
  for (let quarter = 1; quarter <= 4; quarter += 1) touchQuarter(dataset, 2026, quarter);
  return dataset;
}

function okr(partial: Partial<OkrChecklistEntry> & Pick<OkrChecklistEntry, "id" | "quarterId" | "weightage">): OkrChecklistEntry {
  return {
    reporteeId: "rep",
    employeeName: "Asha Rao",
    kpiAffected: "Delivery",
    okrMet: "pending",
    okrs: "Ship the release",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("KPI and OKR pointers", () => {
  it("marks earlier quarters not applicable and leaves later quarters in scope", () => {
    const saved = addKpi(fixture(), "rep", { name: "Customer follow-up", category: "Delivery", pointers: 20, startQuarterId: "q3-2026" });
    const definition = saved.kpiDefinitions[0];
    const rows = saved.kpiAssessments.filter((item) => item.kpiDefinitionId === definition?.id);
    expect(rows.find((item) => item.quarterId === "q1-2026")).toMatchObject({ status: "not_applicable", weightUsed: null });
    expect(rows.find((item) => item.quarterId === "q2-2026")).toMatchObject({ status: "not_applicable", weightUsed: null });
    expect(rows.find((item) => item.quarterId === "q3-2026")).toMatchObject({ status: "pending", weightUsed: 5 });
    expect(rows.find((item) => item.quarterId === "q4-2026")).toMatchObject({ status: "pending", weightUsed: 5 });
  });

  it("rejects a year whose pointers would pass 100", () => {
    const first = addKpi(fixture(), "rep", { name: "Delivery", category: "Delivery", pointers: 80, startQuarterId: "q1-2026" });
    expect(() => addKpi(first, "rep", { name: "Quality", category: "Quality", pointers: 30, startQuarterId: "q1-2026" })).toThrow(/cannot exceed 100/);
    const second = addKpi(first, "rep", { name: "Quality", category: "Quality", pointers: 20, startQuarterId: "q1-2026" });
    expect(annualPointersUsed(second, "rep", 2026)).toBe(100);
  });

  it("keeps a recorded Yes when pointers change and can delete the KPI", () => {
    const created = addKpi(fixture(), "rep", { name: "Delivery", category: "Delivery", pointers: 40, startQuarterId: "q1-2026" });
    const definition = created.kpiDefinitions[0];
    if (!definition) throw new Error("missing definition");
    const scored = {
      ...created,
      kpiAssessments: created.kpiAssessments.map((item) => item.quarterId === "q1-2026" ? { ...item, status: "achieved" as const, recordedStatus: "achieved" as const } : item),
    };
    const edited = updateKpi(scored, definition.id, { name: "Delivery", category: "Delivery", pointers: 20, startQuarterId: "q2-2026" });
    const q1 = edited.kpiAssessments.find((item) => item.quarterId === "q1-2026");
    const q2 = edited.kpiAssessments.find((item) => item.quarterId === "q2-2026");
    expect(q1).toMatchObject({ status: "achieved", weightUsed: 5 });
    expect(q2).toMatchObject({ status: "pending", weightUsed: 5 });
    const removed = removeKpi(edited, definition.id);
    expect(removed.kpiDefinitions).toHaveLength(0);
    expect(removed.kpiAssessments).toHaveLength(0);
  });

  it("rejects OKR pointers over 100 and marks earlier quarters not applicable without pointers", () => {
    const dataset = fixture();
    const heavy = okr({ id: "existing", quarterId: "q4-2026", weightage: 90 });
    const base = upsertChecklist(dataset, heavy);
    expect(() => upsertChecklist(base, okr({ id: "extra", quarterId: "q4-2026", weightage: 20, okrs: "Another line" }))).toThrow(/cannot exceed 100/);
    const saved = upsertChecklist(dataset, okr({ id: "new", quarterId: "q4-2026", weightage: 8, okrs: "Follow up" }), { markEarlierQuartersNotApplicable: true });
    const lines = saved.okrChecklistEntries.filter((item) => item.okrs === "Follow up");
    expect(lines).toHaveLength(4);
    expect(lines.filter((item) => item.okrMet === "not_applicable" && item.weightage == null)).toHaveLength(3);
    expect(lines.find((item) => item.quarterId === "q4-2026")).toMatchObject({ okrMet: "pending", weightage: 8 });
  });
});
