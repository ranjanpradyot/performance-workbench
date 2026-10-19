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
    const santosh = await load("Santosh_OKR_Checklist_Linked_0.3.xlsx", 2);
    expect(utkarsh.sheetNames[0]).toBe("Document_Summary");
    expect(utkarsh.dataset.reportees[0]?.employeeId).toBe("1775");
    expect(utkarsh.dataset.tickets).toHaveLength(55);
    expect(krishna.sheetNames).not.toContain("Document_Summary");
    expect(krishna.dataset.reportees[0]?.employeeId).toBeUndefined();
    expect(krishna.dataset.tickets).toHaveLength(40);
    expect(santosh.dataset.tickets).toHaveLength(48);
    expect(santosh.dataset.kpiDefinitions.some((item) => item.sourceLabel === "Growth")).toBe(true);
    expect(santosh.sheetNames).toContain("Q2-2025_Tickets");
    expect(utkarsh.warnings.join("\n")).not.toContain("OKR_Checklist_Summary");
    const utkarshTotal = utkarsh.dataset.metricSnapshots.find((item) => item.sheet === "OKR_Checklist_Summary" && item.values["Quarter / KPI"] === "Grand Total");
    const krishnaTotal = krishna.dataset.metricSnapshots.find((item) => item.sheet === "OKR_Checklist_Summary" && item.values["Quarter / KPI"] === "Grand Total");
    expect(utkarshTotal?.values["Grand Total"]).toBe("100");
    expect(krishnaTotal?.values["Grand Total"]).toBe("240");
    expect(krishna.dataset.tickets.filter((ticket) => ticket.ticketNo === "32233")).toHaveLength(2);
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
