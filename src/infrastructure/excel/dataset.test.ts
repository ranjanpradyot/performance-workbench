import { describe, expect, it } from "vitest";
import { emptyDataset, replaceReportee, sliceReportee } from "./dataset";

function person(id: string, fullName: string) {
  const stamp = "2026-01-01T00:00:00.000Z";
  return { id, fullName, status: "active" as const, themeColor: "#112233", createdAt: stamp, updatedAt: stamp };
}

function ticket(id: string, reporteeId: string, ticketNo: string) {
  return { id, reporteeId, ticketNo, codeLines: null, sqlLines: null, cycleDays: null, updatedAt: "2026-01-01T00:00:00.000Z" };
}

describe("replaceReportee", () => {
  it("replaces one person and leaves the others in place", () => {
    const current = emptyDataset();
    current.reportees.push(person("rep_utkarsh", "Utkarsh"), person("rep_santosh", "Santosh"));
    current.tickets.push(ticket("old", "rep_utkarsh", "1"), ticket("keep", "rep_santosh", "2"));
    const incoming = emptyDataset();
    incoming.reportees.push(person("rep_utkarsh", "Utkarsh"));
    incoming.tickets.push(ticket("new", "rep_utkarsh", "9"));

    const next = replaceReportee(current, incoming, "rep_utkarsh");

    expect(next.reportees.map((item) => item.fullName)).toEqual(["Santosh", "Utkarsh"]);
    expect(next.tickets.map((item) => item.ticketNo)).toEqual(["2", "9"]);
    expect(next.reportees.find((item) => item.id === "rep_utkarsh")?.themeColor).toBe("#112233");
  });

  it("refuses a workbook for a different person", () => {
    const current = emptyDataset();
    current.reportees.push(person("rep_utkarsh", "Utkarsh"));
    const incoming = emptyDataset();
    incoming.reportees.push(person("rep_krishna", "Krishna"));
    expect(() => replaceReportee(current, incoming, "rep_utkarsh")).toThrow(/does not contain Utkarsh/);
  });

  it("slices one reportee for a JSON backup", () => {
    const current = emptyDataset();
    current.reportees.push(person("rep_utkarsh", "Utkarsh"), person("rep_santosh", "Santosh"));
    current.tickets.push(ticket("a", "rep_utkarsh", "1"), ticket("b", "rep_santosh", "2"));
    const slice = sliceReportee(current, "rep_santosh");
    expect(slice.reportees.map((item) => item.fullName)).toEqual(["Santosh"]);
    expect(slice.tickets.map((item) => item.ticketNo)).toEqual(["2"]);
  });
});
