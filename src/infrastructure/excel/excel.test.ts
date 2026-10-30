import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportReporteeWorkbook, exportSheetOrder } from "@/infrastructure/excel/export-workbook";
import { importWorkbook } from "@/infrastructure/excel/import-workbook";
import ExcelJS from "exceljs";

const fixture = (name: string) => path.resolve("fixtures/workbooks", name);

async function load(name: string, color: number) {
  const buffer = await readFile(fixture(name));
  return importWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), name, color);
}

describe("workbook import and export", () => {
  it("imports Utkarsh, Krishna, and Santosh with their own sheet orders and ticket counts", async () => {
    const utkarsh = await load("Utkarsh_OKR_Checklist_Linked_0.3.xlsx", 0);
    const krishna = await load("Krishna_OKR_Checklist_Linked_v0.2.xlsx", 1);
    const santosh = await load("Santosh_OKR_Checklist_Linked_0.4.xlsx", 2);
    expect(utkarsh.sheetNames[0]).toBe("Document_Summary");
    expect(utkarsh.dataset.reportees[0]?.employeeId).toBe("1775");
    expect(utkarsh.dataset.tickets).toHaveLength(55);
    expect(krishna.sheetNames).not.toContain("Document_Summary");
    expect(krishna.dataset.reportees[0]?.employeeId).toBe("2012");
    expect(krishna.dataset.tickets).toHaveLength(40);
    expect(santosh.dataset.reportees[0]?.employeeId).toBe("2021");
    expect(santosh.dataset.tickets).toHaveLength(50);
    expect(santosh.sheetNames).toContain("Q3-2026_Tickets");
    expect(santosh.sheetNames).toContain("Q3-2026_Ticket_Summary");
    expect(santosh.dataset.tickets.find((ticket) => ticket.ticketNo === "45359")?.quarterId).toBe("q3-2026");
    expect(santosh.dataset.tickets.find((ticket) => ticket.ticketNo === "43310")?.quarterId).toBe("q3-2026");
    expect(santosh.dataset.tickets.find((ticket) => ticket.ticketNo === "45359")?.cycleDays).toBeNull();
    expect(santosh.dataset.kpiDefinitions.some((item) => item.sourceLabel === "Growth")).toBe(false);
    expect(santosh.dataset.kpiDefinitions.find((item) => item.year === 2026 && item.sourceLabel === "Execution")?.annualWeight).toBe(30);
    expect(santosh.dataset.kpiAssessments.find((row) => row.id === "kpa_rep_santosh_q2-2026_execution")?.weightUsed).toBe(7.5);
    expect(santosh.sheetNames).toContain("Q2-2025_Tickets");
    expect(utkarsh.warnings.join("\n")).not.toContain("OKR_Checklist_Summary");
    const utkarshTotal = utkarsh.dataset.metricSnapshots.find((item) => item.sheet === "OKR_Checklist_Summary" && item.values["Quarter / KPI"] === "Grand Total");
    const krishnaTotal = krishna.dataset.metricSnapshots.find((item) => item.sheet === "OKR_Checklist_Summary" && item.values["Quarter / KPI"] === "Grand Total");
    expect(utkarshTotal?.values["Grand Total"]).toBe("100");
    expect(krishnaTotal?.values["Grand Total"]).toBe("240");
    expect(krishna.dataset.tickets.filter((ticket) => ticket.ticketNo === "32233")).toHaveLength(2);
    const learning = utkarsh.dataset.kpiAssessments.find((row) => row.id === "kpa_rep_utkarsh_q1-2026_learning-and-development");
    expect(learning?.evidenceRefs[0]).toBe("Utkarsh_OKR_Checklist!A25");
    const krishna03 = await load("Krishna_OKR_Checklist_Linked_0.3.xlsx", 1);
    expect(krishna03.sheetNames[0]).toBe("Document_Summary");
    expect(krishna03.dataset.reportees[0]?.employeeId).toBe("2012");
    expect(krishna03.dataset.tickets).toHaveLength(40);
    expect(krishna03.dataset.tickets.filter((ticket) => ticket.ticketNo === "32233")).toHaveLength(2);
    expect(krishna03.dataset.tickets.find((ticket) => ticket.ticketNo === "35062")?.cycleDays).toBe(42);
    expect(krishna03.dataset.assessmentRules[0]?.scoreModel).toBe("scoped_quarter_weight");
    const krishnaTotal03 = krishna03.dataset.metricSnapshots.find((item) => item.sheet === "OKR_Checklist_Summary" && item.values["Quarter / KPI"] === "Grand Total");
    expect(krishnaTotal03?.values["Grand Total"]).toBe("100");
    const delivery = krishna03.dataset.kpiAssessments.find((row) => row.id === "kpa_rep_krishna_q3-2025_project-delivery");
    expect(delivery?.weightUsed).toBe(14.5);
    expect(delivery?.status).toBe("achieved");
    const utkarsh04 = await load("Utkarsh_OKR_Checklist_Linked_0.4.xlsx", 0);
    const krishna04 = await load("Krishna_OKR_Checklist_Linked_0.4.xlsx", 1);
    expect(krishna04.dataset.reportees[0]?.employeeId).toBe("2012");
    expect(utkarsh04.dataset.tickets.find((ticket) => ticket.ticketNo === "42241")?.defectLike).toBe(true);
    expect(utkarsh04.dataset.tickets.find((ticket) => ticket.ticketNo === "23703" && ticket.quarterId === "q3-2026")?.defectLike).toBe(false);
    expect(utkarsh04.dataset.kpiAssessments.find((row) => row.id === "kpa_rep_utkarsh_q3-2026_quality")?.status).toBe("achieved");
    expect(krishna04.dataset.tickets.find((ticket) => ticket.ticketNo === "16788")?.defectLike).toBe(true);
    expect(krishna04.dataset.tickets.find((ticket) => ticket.ticketNo === "32233" && ticket.quarterId === "q3-2026")?.defectLike).toBe(false);
    expect(krishna04.dataset.kpiAssessments.find((row) => row.id === "kpa_rep_krishna_q3-2026_quality")?.status).toBe("achieved");
    expect(utkarsh04.dataset.kpiAssessments.find((row) => row.id === "kpa_rep_utkarsh_q3-2026_learning-and-development")?.status).toBe("achieved");
    expect(utkarsh04.dataset.learningEvidence.find((row) => row.quarterId === "q3-2026")?.evidenceLink).toContain("/2026/Utkarsh/Q3/");
    expect(krishna04.dataset.learningEvidence.find((row) => row.quarterId === "q3-2026")?.evidenceLink).toContain("/2026/Krishnaraj/Q3/");
    expect(santosh.dataset.kpiAssessments.find((row) => row.id === "kpa_rep_santosh_q3-2026_l-and-d")?.status).toBe("achieved");
    expect(santosh.dataset.learningEvidence.find((row) => row.quarterId === "q3-2026")?.evidenceLink).toContain("/2026/Santosh/Q3/");
  });

  it("keeps a blank line count blank and preserves a real zero", async () => {
    const utkarsh = await load("Utkarsh_OKR_Checklist_Linked_0.3.xlsx", 0);
    const open = utkarsh.dataset.tickets.find((ticket) => ticket.ticketNo === "21546");
    expect(open?.codeLines).toBeNull();
    expect(open?.sqlLines).toBe(32);
    expect(open?.closureDate).toBeUndefined();
  });

  it("exports Utkarsh with the source sheet order and reopens the checklist header", async () => {
    const imported = await load("Utkarsh_OKR_Checklist_Linked_0.3.xlsx", 0);
    const order = exportSheetOrder(imported.dataset, imported.dataset.reportees[0]);
    expect(order[0]).toBe("Document_Summary");
    expect(order).toContain("Utkarsh_OKR_Checklist");
    expect(order.indexOf("Tickets_Master_Utkarsh")).toBeLessThan(order.indexOf("Q3-2025_Tickets"));
    const buffer = await exportReporteeWorkbook(imported.dataset, imported.dataset.reportees[0].id);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(order);
    const checklist = workbook.getWorksheet("Utkarsh_OKR_Checklist");
    expect(checklist?.getCell(1, 1).value).toBe("Employee Name");
    expect(checklist?.getCell(1, 8).value).toBe("OKRs");
    const master = workbook.getWorksheet("Tickets_Master_Utkarsh");
    const headerRow = 6;
    expect(master?.getCell(headerRow, 1).value).toBe("Ticket No.");
    let blankCode: ExcelJS.CellValue = 0;
    master?.eachRow((row) => {
      const ticketNo = row.getCell(1).value;
      if (ticketNo === "21546" || ticketNo === 21546) blankCode = row.getCell(10).value;
    });
    expect(blankCode ?? null).toBeNull();
    const orderAgain = exportSheetOrder(imported.dataset, imported.dataset.reportees[0]);
    for (const name of imported.sheetNames) expect(orderAgain).toContain(name);
  });
});
