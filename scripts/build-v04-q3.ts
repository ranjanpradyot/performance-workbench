/**
 * Build Utkarsh / Krishna v0.4 workbooks from 0.3 by folding in Q3-2026 tickets
 * from the MasterData Sheet, cloning Q2 ticket sheet layout/links, and refreshing
 * derived ticket views. Then rebuild public/seed/initial-dataset.json.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { mergeDatasets } from "../src/infrastructure/excel/dataset";
import { importWorkbook } from "../src/infrastructure/excel/import-workbook";

const MASTER_PATH = "c:/Users/pradyot/Downloads/MasterData Sheet.xlsx";
const WORKBOOKS = path.resolve("fixtures/workbooks");
const QUARTER = "Q3-2026";
const QUARTER_ID = "q3-2026";

interface MasterTicket {
  ticketNo: string;
  description: string;
  status: string;
  assignee: "Utkarsh" | "Krishna";
  codePrUrl?: string;
  codeLines: number | null;
  sqlPrUrl?: string;
  sqlLines: number | null;
  dataIssue?: string;
  note?: string;
  issueCategory?: string;
  category?: string;
}

interface TicketRow {
  ticketNo: string;
  description: string;
  status: string;
  month?: Date | string;
  assignDate?: Date | string;
  closureDate?: Date | string;
  owner: string;
  spChange?: string;
  codeChange?: string;
  codeLines: number | null;
  sqlLines: number | null;
  quarter: string;
  cycleDays: number | null;
  azurePrUrl?: string;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if ("richText" in o) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in o) return String(o.text ?? "");
    if ("result" in o) return String(o.result ?? "");
    if ("hyperlink" in o) return String(o.text ?? o.hyperlink ?? "");
  }
  return String(value);
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function cellDate(value: ExcelJS.CellValue): Date | string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "result" in (value as object)) {
    const result = (value as { result?: unknown }).result;
    if (result instanceof Date) return result;
  }
  const text = cellText(value).trim();
  return text || undefined;
}

function normalizeStatus(raw: string): string {
  const s = raw.trim();
  const lower = s.toLowerCase();
  if (lower === "closed") return "Closed";
  if (lower === "resolved") return "Resolved";
  if (lower === "on hold" || lower === "onhold") return "OnHold";
  if (lower === "in uat" || lower === "in-uat") return "In-UAT";
  if (lower === "in progress" || lower === "inprogress") return "InProgress";
  return s;
}

function isClosed(status: string): boolean {
  const lower = status.trim().toLowerCase();
  return lower === "closed" || lower === "resolved";
}

function checklistName(person: string): string {
  return `${person}_OKR_Checklist`;
}

function linkToChecklist(cell: ExcelJS.Cell, person: string): void {
  const sheet = checklistName(person);
  cell.value = { text: `${sheet}!A1`, hyperlink: `#'${sheet}'!A1` };
  cell.font = { name: "Calibri", color: { argb: "FF0563C1" }, underline: true };
}

function navyHeader(sheet: ExcelJS.Worksheet, rowNumber: number, headers: string[]): void {
  headers.forEach((header, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = header;
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  sheet.views = [{ state: "frozen", ySplit: rowNumber, showGridLines: false }];
  sheet.autoFilter = { from: { row: rowNumber, column: 1 }, to: { row: rowNumber, column: headers.length } };
}

function writeDateCell(cell: ExcelJS.Cell, value: Date | string | undefined): void {
  if (value == null || value === "") return;
  if (value instanceof Date) {
    cell.value = value;
    cell.numFmt = "yyyy-mm-dd";
    return;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    cell.value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    cell.numFmt = "yyyy-mm-dd";
    return;
  }
  cell.value = value;
}

function writeTicketCells(sheet: ExcelJS.Worksheet, rowNumber: number, ticket: TicketRow): void {
  sheet.getCell(rowNumber, 1).value = ticket.ticketNo;
  sheet.getCell(rowNumber, 2).value = ticket.description;
  sheet.getCell(rowNumber, 2).alignment = { wrapText: true, vertical: "top" };
  sheet.getCell(rowNumber, 3).value = ticket.status;
  writeDateCell(sheet.getCell(rowNumber, 4), ticket.month);
  writeDateCell(sheet.getCell(rowNumber, 5), ticket.assignDate);
  writeDateCell(sheet.getCell(rowNumber, 6), ticket.closureDate);
  sheet.getCell(rowNumber, 7).value = ticket.owner;
  if (ticket.spChange) sheet.getCell(rowNumber, 8).value = ticket.spChange;
  if (ticket.codeChange) sheet.getCell(rowNumber, 9).value = ticket.codeChange;
  if (ticket.codeLines != null) sheet.getCell(rowNumber, 10).value = ticket.codeLines;
  if (ticket.sqlLines != null) sheet.getCell(rowNumber, 11).value = ticket.sqlLines;
  sheet.getCell(rowNumber, 12).value = ticket.quarter;
  if (ticket.cycleDays != null) sheet.getCell(rowNumber, 13).value = ticket.cycleDays;
}

async function readMasterTickets(): Promise<MasterTicket[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(MASTER_PATH);
  const sheet = wb.getWorksheet("Ticket Master Data");
  if (!sheet) throw new Error("Ticket Master Data sheet not found");
  const tickets: MasterTicket[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const ticketNo = cellText(row.getCell(1).value).trim();
    if (!/^\d+$/.test(ticketNo)) return;
    const assigneeRaw = cellText(row.getCell(6).value).trim();
    if (assigneeRaw !== "Utkarsh" && assigneeRaw !== "Krishna") return;
    const codePr = cellText(row.getCell(8).value).trim() || undefined;
    const sqlPr = cellText(row.getCell(11).value).trim() || undefined;
    tickets.push({
      ticketNo,
      description: cellText(row.getCell(3).value).trim(),
      status: normalizeStatus(cellText(row.getCell(7).value)),
      assignee: assigneeRaw,
      codePrUrl: codePr?.startsWith("http") ? codePr : undefined,
      codeLines: cellNumber(row.getCell(9).value),
      sqlPrUrl: sqlPr?.startsWith("http") ? sqlPr : undefined,
      sqlLines: cellNumber(row.getCell(12).value),
      dataIssue: cellText(row.getCell(14).value).trim() || undefined,
      note: cellText(row.getCell(16).value).trim() || undefined,
      issueCategory: cellText(row.getCell(4).value).trim() || undefined,
      category: cellText(row.getCell(5).value).trim() || undefined,
    });
  });
  return tickets;
}

function toTicketRow(master: MasterTicket, prior?: TicketRow): TicketRow {
  const hasCode = master.codeLines != null || Boolean(master.codePrUrl);
  const hasSql = master.sqlLines != null || Boolean(master.sqlPrUrl);
  return {
    ticketNo: master.ticketNo,
    description: master.description || prior?.description || "",
    status: master.status || prior?.status || "",
    month: prior?.month,
    assignDate: prior?.assignDate,
    closureDate: prior?.closureDate,
    owner: master.assignee,
    spChange: hasSql ? "yes" : undefined,
    codeChange: hasCode ? "yes" : undefined,
    codeLines: master.codeLines,
    sqlLines: master.sqlLines,
    quarter: QUARTER,
    cycleDays: prior?.cycleDays ?? null,
    azurePrUrl: master.codePrUrl ?? master.sqlPrUrl ?? prior?.azurePrUrl,
  };
}

function readMasterSheetTickets(sheet: ExcelJS.Worksheet): { headerRow: number; tickets: TicketRow[] } {
  let headerRow = -1;
  sheet.eachRow((row, rowNumber) => {
    if (cellText(row.getCell(1).value) === "Ticket No." && cellText(row.getCell(3).value) === "Status") headerRow = rowNumber;
  });
  if (headerRow < 0) throw new Error(`Header not found on ${sheet.name}`);
  const tickets: TicketRow[] = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const ticketNo = cellText(row.getCell(1).value).trim();
    if (!/^\d+$/.test(ticketNo)) continue;
    tickets.push({
      ticketNo,
      description: cellText(row.getCell(2).value),
      status: cellText(row.getCell(3).value),
      month: cellDate(row.getCell(4).value),
      assignDate: cellDate(row.getCell(5).value),
      closureDate: cellDate(row.getCell(6).value),
      owner: cellText(row.getCell(7).value),
      spChange: cellText(row.getCell(8).value) || undefined,
      codeChange: cellText(row.getCell(9).value) || undefined,
      codeLines: cellNumber(row.getCell(10).value),
      sqlLines: cellNumber(row.getCell(11).value),
      quarter: cellText(row.getCell(12).value),
      cycleDays: cellNumber(row.getCell(13).value),
    });
  }
  return { headerRow, tickets };
}

function clearDataRows(sheet: ExcelJS.Worksheet, headerRow: number): void {
  const last = sheet.rowCount;
  for (let r = last; r > headerRow; r -= 1) {
    sheet.spliceRows(r, 1);
  }
}

function findQuarterDataRow(sheet: ExcelJS.Worksheet, headerRow: number, quarterLabel: string): number | null {
  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    if (cellText(sheet.getCell(r, 1).value) === quarterLabel) return r;
  }
  return null;
}

function summarize(tickets: TicketRow[]) {
  const closed = tickets.filter((t) => isClosed(t.status));
  const open = tickets.filter((t) => !isClosed(t.status));
  const codeChange = tickets.filter((t) => (t.codeChange ?? "").toLowerCase() === "yes").length;
  const spChange = tickets.filter((t) => (t.spChange ?? "").toLowerCase() === "yes").length;
  const codeLines = tickets.reduce((sum, t) => sum + (t.codeLines ?? 0), 0);
  const sqlLines = tickets.reduce((sum, t) => sum + (t.sqlLines ?? 0), 0);
  const hasCode = tickets.some((t) => t.codeLines != null);
  const hasSql = tickets.some((t) => t.sqlLines != null);
  const spillPct = tickets.length ? Math.round((open.length / tickets.length) * 1000) / 10 : 0;
  const cycle = closed.map((t) => t.cycleDays).filter((v): v is number => v != null);
  const avgCycle = cycle.length ? Math.round((cycle.reduce((a, b) => a + b, 0) / cycle.length) * 10) / 10 : null;
  return {
    total: tickets.length,
    closed: closed.length,
    open: open.length,
    openNos: open.map((t) => t.ticketNo),
    spillPct,
    codeChange,
    spChange,
    codeLines: hasCode ? codeLines : null,
    sqlLines: hasSql ? sqlLines : null,
    avgCycle,
  };
}

function copyColumnWidths(from: ExcelJS.Worksheet, to: ExcelJS.Worksheet, columns = 13): void {
  for (let c = 1; c <= columns; c += 1) {
    to.getColumn(c).width = from.getColumn(c).width ?? 14;
  }
}

function ensureQuarterTicketSheets(wb: ExcelJS.Workbook, person: string, tickets: TicketRow[]): void {
  const templateTickets = wb.getWorksheet("Q2-2026_Tickets");
  const templateSummary = wb.getWorksheet("Q2-2026_Ticket_Summary");
  if (!templateTickets || !templateSummary) throw new Error("Q2-2026 ticket sheets missing");

  let ticketsSheet = wb.getWorksheet(`${QUARTER}_Tickets`);
  if (ticketsSheet) wb.removeWorksheet(ticketsSheet.id);
  ticketsSheet = wb.addWorksheet(`${QUARTER}_Tickets`, { views: [{ showGridLines: false }] });
  copyColumnWidths(templateTickets, ticketsSheet);
  linkToChecklist(ticketsSheet.getCell(1, 1), person);
  ticketsSheet.mergeCells(3, 1, 3, 13);
  ticketsSheet.getCell(3, 1).value = `${QUARTER} — ticket evidence pack (from Tickets_Master_${person})`;
  ticketsSheet.getCell(3, 1).font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF1F4E79" } };
  const ticketHeaders = [
    "Ticket No.",
    "Description",
    "Status",
    "Month",
    "Assign Date",
    "Closure Date",
    "Owner",
    "SP Change",
    "Code Change",
    "Code Lines Changed",
    "SQL Lines Changed",
    "Quarter",
    "Cycle Days",
  ];
  navyHeader(ticketsSheet, 5, ticketHeaders);
  tickets.forEach((ticket, index) => writeTicketCells(ticketsSheet!, 6 + index, ticket));

  let summarySheet = wb.getWorksheet(`${QUARTER}_Ticket_Summary`);
  if (summarySheet) wb.removeWorksheet(summarySheet.id);
  summarySheet = wb.addWorksheet(`${QUARTER}_Ticket_Summary`, { views: [{ showGridLines: false }] });
  copyColumnWidths(templateSummary, summarySheet, 3);
  linkToChecklist(summarySheet.getCell(1, 1), person);
  summarySheet.mergeCells(3, 1, 3, 3);
  summarySheet.getCell(3, 1).value = `${QUARTER} Summary`;
  summarySheet.getCell(3, 1).font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF1F4E79" } };
  navyHeader(summarySheet, 5, ["Metric", "Value", "Achieved/Not Achieved"]);
  const stats = summarize(tickets);
  const spillYes = stats.open <= 2 || stats.spillPct <= 20 ? "Yes" : "No";
  const rows: Array<[string, number | string | null, string | null]> = [
    ["Total tickets", stats.total, null],
    ["Closed/Resolved", stats.closed, stats.closed > 0 ? "Yes" : null],
    ["Open / spill", stats.open, spillYes],
    ["Spill %", stats.spillPct, spillYes],
    ["Code Change tickets", stats.codeChange, stats.codeChange > 0 ? "Yes" : null],
    ["SP Change tickets", stats.spChange, stats.spChange > 0 ? "Yes" : null],
    ["Code Lines", stats.codeLines, null],
    ["SQL Lines", stats.sqlLines, null],
    ["Avg Cycle Days", stats.avgCycle, stats.avgCycle != null ? "Yes" : null],
    ["Defect-like themes", "—", null],
    ["Rework proxy count", 0, "Yes"],
    ["Delivery target", "—", null],
  ];
  rows.forEach((entry, index) => {
    summarySheet!.getCell(6 + index, 1).value = entry[0];
    if (entry[1] != null && entry[1] !== "") summarySheet!.getCell(6 + index, 2).value = entry[1];
    if (entry[2]) summarySheet!.getCell(6 + index, 3).value = entry[2];
  });

  // Keep chronological order after Q2 by setting orderNo (ExcelJS has no moveSheet).
  const q2Summary = wb.getWorksheet("Q2-2026_Ticket_Summary");
  if (q2Summary) {
    ticketsSheet.orderNo = q2Summary.orderNo + 1;
    summarySheet.orderNo = q2Summary.orderNo + 2;
  }
}

function rewriteMaster(sheet: ExcelJS.Worksheet, person: string, keep: TicketRow[], q3: TicketRow[]): void {
  const { headerRow } = readMasterSheetTickets(sheet);
  clearDataRows(sheet, headerRow);
  const all = [...keep, ...q3].sort((a, b) => {
    const qa = a.quarter.localeCompare(b.quarter);
    if (qa !== 0) return qa;
    return Number(a.ticketNo) - Number(b.ticketNo);
  });
  all.forEach((ticket, index) => writeTicketCells(sheet, headerRow + 1 + index, ticket));
  // Keep title/note rows intact; ensure back-link remains.
  linkToChecklist(sheet.getCell(1, 1), person);
}

function updateCodeChangeTickets(sheet: ExcelJS.Worksheet, person: string, allTickets: TicketRow[]): void {
  let headerRow = -1;
  sheet.eachRow((row, rowNumber) => {
    if (cellText(row.getCell(1).value) === "Ticket No." && cellText(row.getCell(4).value) === "Quarter") headerRow = rowNumber;
  });
  if (headerRow < 0) throw new Error("CodeChange_Tickets header missing");
  clearDataRows(sheet, headerRow);
  const codeTickets = allTickets.filter(
    (t) => (t.codeChange ?? "").toLowerCase() === "yes" || (t.spChange ?? "").toLowerCase() === "yes",
  );
  codeTickets.forEach((ticket, index) => {
    const row = headerRow + 1 + index;
    sheet.getCell(row, 1).value = ticket.ticketNo;
    sheet.getCell(row, 2).value = ticket.description;
    sheet.getCell(row, 3).value = ticket.status;
    sheet.getCell(row, 4).value = ticket.quarter;
    if (ticket.codeChange) sheet.getCell(row, 5).value = ticket.codeChange;
    if (ticket.spChange) sheet.getCell(row, 6).value = ticket.spChange;
    if (ticket.codeLines != null) sheet.getCell(row, 7).value = ticket.codeLines;
    if (ticket.sqlLines != null) sheet.getCell(row, 8).value = ticket.sqlLines;
    writeDateCell(sheet.getCell(row, 9), ticket.assignDate);
    writeDateCell(sheet.getCell(row, 10), ticket.closureDate);
    if (ticket.azurePrUrl) {
      sheet.getCell(row, 11).value = { text: ticket.azurePrUrl, hyperlink: ticket.azurePrUrl };
      sheet.getCell(row, 11).font = { name: "Calibri", color: { argb: "FF0563C1" }, underline: true };
    }
  });
  linkToChecklist(sheet.getCell(1, 1), person);
}

function upsertMetricRow(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  quarterLabel: string,
  values: Array<string | number | null>,
): void {
  let row = findQuarterDataRow(sheet, headerRow, quarterLabel);
  if (row == null) {
    row = sheet.rowCount + 1;
    // Insert before MASTER TOTALS / blank footer if present.
    for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
      const label = cellText(sheet.getCell(r, 1).value).toUpperCase();
      if (label.startsWith("MASTER") || label.startsWith("SCOPE") || label === "") {
        row = r;
        sheet.spliceRows(r, 0, []);
        break;
      }
    }
  }
  values.forEach((value, index) => {
    const cell = sheet.getCell(row!, index + 1);
    if (value == null || value === "") {
      cell.value = null;
      return;
    }
    cell.value = value;
  });
}

function updateDerivedSheets(wb: ExcelJS.Workbook, person: string, q3: TicketRow[], allTickets: TicketRow[]): void {
  const stats = summarize(q3);
  const masterName = `Tickets_Master_${person}`;

  const velocity = wb.getWorksheet("Ticket_Velocity");
  if (velocity) {
    let headerRow = -1;
    velocity.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Quarter" && cellText(row.getCell(2).value).includes("Total")) headerRow = rowNumber;
    });
    if (headerRow > 0) {
      upsertMetricRow(velocity, headerRow, QUARTER, [
        QUARTER,
        stats.total,
        stats.closed,
        stats.open,
        "—",
        "—",
        "Outside appraisal scope (master completeness)",
        masterName,
      ]);
    }
    // Refresh master totals footer when present.
    for (let r = 1; r <= velocity.rowCount; r += 1) {
      if (cellText(velocity.getCell(r, 1).value) === "All master tickets") {
        const closed = allTickets.filter((t) => isClosed(t.status)).length;
        const open = allTickets.length - closed;
        const codeChange = allTickets.filter((t) => (t.codeChange ?? "").toLowerCase() === "yes").length;
        const spChange = allTickets.filter((t) => (t.spChange ?? "").toLowerCase() === "yes").length;
        const codeLines = allTickets.reduce((s, t) => s + (t.codeLines ?? 0), 0);
        const sqlLines = allTickets.reduce((s, t) => s + (t.sqlLines ?? 0), 0);
        velocity.getCell(r, 2).value = allTickets.length;
        velocity.getCell(r, 3).value = closed;
        velocity.getCell(r, 4).value = open;
        velocity.getCell(r, 5).value = codeChange;
        velocity.getCell(r, 6).value = spChange;
        velocity.getCell(r, 7).value = codeLines;
        velocity.getCell(r, 8).value = sqlLines;
      }
    }
    linkToChecklist(velocity.getCell(1, 1), person);
  }

  const spill = wb.getWorksheet("Ticket_Spillover");
  if (spill) {
    let headerRow = -1;
    spill.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Quarter" && cellText(row.getCell(3).value).toLowerCase().includes("open")) headerRow = rowNumber;
    });
    if (headerRow > 0) {
      const yes = stats.open <= 2 || stats.spillPct <= 20 ? "Yes" : "No";
      upsertMetricRow(spill, headerRow, QUARTER, [
        QUARTER,
        stats.total,
        stats.open,
        stats.spillPct,
        yes,
        stats.openNos.join(", ") || "-",
        "Achieved if open<=2 or spill%<=20",
      ]);
    }
    linkToChecklist(spill.getCell(1, 1), person);
  }

  const firstCut = wb.getWorksheet("FirstCut_Quality");
  if (firstCut) {
    let headerRow = -1;
    firstCut.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Quarter") headerRow = rowNumber;
    });
    const codeSp = q3.filter((t) => (t.codeChange ?? "").toLowerCase() === "yes" || (t.spChange ?? "").toLowerCase() === "yes");
    const closedCode = codeSp.filter((t) => isClosed(t.status)).length;
    const codeLines = codeSp.reduce((s, t) => s + (t.codeLines ?? 0), 0);
    const sqlLines = codeSp.reduce((s, t) => s + (t.sqlLines ?? 0), 0);
    if (headerRow > 0) {
      upsertMetricRow(firstCut, headerRow, QUARTER, [
        QUARTER,
        codeSp.length,
        closedCode,
        codeLines || null,
        sqlLines || null,
        "—",
        "Proxy only. Outside appraisal scope for Q3-2026.",
      ]);
    }
    linkToChecklist(firstCut.getCell(1, 1), person);
  }

  const codeSummary = wb.getWorksheet("CodeChange_Summary");
  if (codeSummary) {
    let headerRow = -1;
    codeSummary.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Quarter") headerRow = rowNumber;
    });
    if (headerRow > 0) {
      const values: Array<string | number | null> = [
        QUARTER,
        stats.codeChange,
        stats.spChange,
        stats.codeLines,
        stats.sqlLines,
        "—",
        "Outside appraisal scope (master completeness)",
      ];
      // Utkarsh/Santosh have PR rejection columns; keep blank for out-of-scope Q3.
      if (person === "Utkarsh") {
        values.push(null, null);
      }
      upsertMetricRow(codeSummary, headerRow, QUARTER, values);
    }
    linkToChecklist(codeSummary.getCell(1, 1), person);
  }

  const sla = wb.getWorksheet("SLA_CycleDays");
  if (sla) {
    let headerRow = -1;
    sla.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Quarter") headerRow = rowNumber;
    });
    if (headerRow > 0) {
      const cycles = q3.filter((t) => isClosed(t.status)).map((t) => t.cycleDays).filter((v): v is number => v != null);
      const avg = cycles.length ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10 : null;
      const max = cycles.length ? Math.max(...cycles) : null;
      upsertMetricRow(sla, headerRow, QUARTER, [
        QUARTER,
        stats.closed,
        avg,
        max,
        "—",
        "Outside appraisal scope (master completeness)",
      ]);
    }
    linkToChecklist(sla.getCell(1, 1), person);
  }

  const defects = wb.getWorksheet("Customer_Defect_Themes");
  if (defects) {
    let headerRow = -1;
    defects.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Quarter" && cellText(row.getCell(2).value).toLowerCase().includes("closed")) headerRow = rowNumber;
    });
    if (headerRow > 0) {
      upsertMetricRow(defects, headerRow, QUARTER, [
        QUARTER,
        stats.closed,
        "—",
        "—",
        "-",
        "Outside appraisal scope; defect-like flags not curated for Q3-2026 yet.",
      ]);
    }
    linkToChecklist(defects.getCell(1, 1), person);
  }

  const rework = wb.getWorksheet("Rework_Reopen_Proxy");
  if (rework) {
    let headerRow = -1;
    rework.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Quarter") headerRow = rowNumber;
    });
    if (headerRow > 0) {
      upsertMetricRow(rework, headerRow, QUARTER, [
        QUARTER,
        stats.total,
        0,
        0,
        "—",
        "-",
      ]);
    }
    linkToChecklist(rework.getCell(1, 1), person);
  }
}

function appendDocumentNote(sheet: ExcelJS.Worksheet, person: string, ticketCount: number): void {
  let last = 2;
  sheet.eachRow((row, rowNumber) => {
    if (cellText(row.getCell(1).value)) last = rowNumber;
  });
  const row = last + 1;
  sheet.getCell(row, 1).value = "0.4";
  sheet.getCell(row, 2).value = "Tickets";
  sheet.getCell(row, 3).value =
    `Q3-2026 tickets loaded from MasterData Sheet (${ticketCount} rows for ${person}). Added ${QUARTER}_Tickets and ${QUARTER}_Ticket_Summary with the same layout and checklist links as Q2. Master and derived ticket views updated. Appraisal KPI scores remain the 0.3 two-quarter scope unless separately reassessed.`;
  sheet.getCell(row, 3).alignment = { wrapText: true };
  // Keep the original document title in A1 (do not replace with a checklist hyperlink).
  const title = cellText(sheet.getCell(1, 1).value);
  if (!title || title.includes("_OKR_Checklist")) {
    sheet.getCell(1, 1).value = `${person} OKR checklist — document summary`;
    sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF1F4E79" } };
  }
}

async function buildPersonWorkbook(
  person: "Utkarsh" | "Krishna",
  sourceName: string,
  targetName: string,
  masterTickets: MasterTicket[],
  priorQ3ByNo: Map<string, TicketRow>,
): Promise<{ tickets: number; path: string }> {
  const source = path.join(WORKBOOKS, sourceName);
  const target = path.join(WORKBOOKS, targetName);
  await copyFile(source, target);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(target);

  const masterSheet = wb.getWorksheet(`Tickets_Master_${person}`);
  if (!masterSheet) throw new Error(`Tickets_Master_${person} missing`);
  const { tickets: existing } = readMasterSheetTickets(masterSheet);
  const keep = existing.filter((t) => t.quarter !== QUARTER);

  // Pull Azure PR URLs from existing CodeChange_Tickets for non-Q3 rows.
  const codeSheet = wb.getWorksheet("CodeChange_Tickets");
  const prByKey = new Map<string, string>();
  if (codeSheet) {
    let headerRow = -1;
    codeSheet.eachRow((row, rowNumber) => {
      if (cellText(row.getCell(1).value) === "Ticket No.") headerRow = rowNumber;
    });
    if (headerRow > 0) {
      for (let r = headerRow + 1; r <= codeSheet.rowCount; r += 1) {
        const no = cellText(codeSheet.getCell(r, 1).value);
        const quarter = cellText(codeSheet.getCell(r, 4).value);
        const url = cellText(codeSheet.getCell(r, 11).value);
        if (no && url.startsWith("http")) prByKey.set(`${no}|${quarter}`, url);
      }
    }
  }
  for (const ticket of keep) {
    const url = prByKey.get(`${ticket.ticketNo}|${ticket.quarter}`);
    if (url) ticket.azurePrUrl = url;
  }

  const q3 = masterTickets
    .filter((t) => t.assignee === person)
    .map((t) => toTicketRow(t, priorQ3ByNo.get(t.ticketNo)));

  rewriteMaster(masterSheet, person, keep, q3);
  ensureQuarterTicketSheets(wb, person, q3);
  const allTickets = [...keep, ...q3];
  if (codeSheet) updateCodeChangeTickets(codeSheet, person, allTickets);
  updateDerivedSheets(wb, person, q3, allTickets);

  const doc = wb.getWorksheet("Document_Summary");
  if (doc) appendDocumentNote(doc, person, q3.length);

  await wb.xlsx.writeFile(target);
  return { tickets: q3.length, path: target };
}

async function collectPriorQ3(): Promise<Map<string, TicketRow>> {
  const map = new Map<string, TicketRow>();
  for (const file of ["Utkarsh_OKR_Checklist_Linked_0.3.xlsx", "Krishna_OKR_Checklist_Linked_0.3.xlsx"]) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(WORKBOOKS, file));
    const person = file.startsWith("Utkarsh") ? "Utkarsh" : "Krishna";
    const master = wb.getWorksheet(`Tickets_Master_${person}`);
    if (!master) continue;
    const { tickets } = readMasterSheetTickets(master);
    for (const ticket of tickets.filter((t) => t.quarter === QUARTER)) {
      map.set(ticket.ticketNo, ticket);
    }
    const code = wb.getWorksheet("CodeChange_Tickets");
    if (code) {
      let headerRow = -1;
      code.eachRow((row, rowNumber) => {
        if (cellText(row.getCell(1).value) === "Ticket No.") headerRow = rowNumber;
      });
      if (headerRow > 0) {
        for (let r = headerRow + 1; r <= code.rowCount; r += 1) {
          const no = cellText(code.getCell(r, 1).value);
          const quarter = cellText(code.getCell(r, 4).value);
          const url = cellText(code.getCell(r, 11).value);
          if (quarter === QUARTER && no && url.startsWith("http")) {
            const existing = map.get(no);
            if (existing) existing.azurePrUrl = url;
          }
        }
      }
    }
  }
  return map;
}

async function rebuildSeed(files: string[]): Promise<void> {
  const parts = [];
  for (const [index, file] of files.entries()) {
    const buffer = await readFile(path.resolve(WORKBOOKS, file));
    const result = await importWorkbook(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      file,
      index,
    );
    console.log(file, result.dataset.tickets.length, "tickets", result.warnings.length, "warnings");
    result.warnings.slice(0, 12).forEach((warning) => console.log(" ", warning));
    parts.push(result.dataset);
  }
  const dataset = mergeDatasets(parts);
  dataset.application.revision = Math.max(dataset.application.revision, 1) + 1;
  dataset.application.updatedAt = new Date().toISOString();
  const target = path.resolve("public/seed/initial-dataset.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(dataset));
  console.log("wrote", target, "reportees", dataset.reportees.length, "tickets", dataset.tickets.length, "revision", dataset.application.revision);
  const q3 = dataset.tickets.filter((t) => t.quarterId === QUARTER_ID);
  console.log(
    "Q3-2026 tickets:",
    q3.length,
    "Utkarsh",
    q3.filter((t) => t.reporteeId === "rep_utkarsh").length,
    "Krishna",
    q3.filter((t) => t.reporteeId === "rep_krishna").length,
    "Santosh",
    q3.filter((t) => t.reporteeId === "rep_santosh").length,
  );
}

async function main() {
  const masterTickets = await readMasterTickets();
  console.log(
    "MasterData Q3 tickets:",
    masterTickets.length,
    "Utkarsh",
    masterTickets.filter((t) => t.assignee === "Utkarsh").length,
    "Krishna",
    masterTickets.filter((t) => t.assignee === "Krishna").length,
  );
  const prior = await collectPriorQ3();
  const utk = await buildPersonWorkbook(
    "Utkarsh",
    "Utkarsh_OKR_Checklist_Linked_0.3.xlsx",
    "Utkarsh_OKR_Checklist_Linked_0.4.xlsx",
    masterTickets,
    prior,
  );
  const kri = await buildPersonWorkbook(
    "Krishna",
    "Krishna_OKR_Checklist_Linked_0.3.xlsx",
    "Krishna_OKR_Checklist_Linked_0.4.xlsx",
    masterTickets,
    prior,
  );
  console.log("wrote", utk.path, "Q3 tickets", utk.tickets);
  console.log("wrote", kri.path, "Q3 tickets", kri.tickets);

  await rebuildSeed([
    "Utkarsh_OKR_Checklist_Linked_0.4.xlsx",
    "Krishna_OKR_Checklist_Linked_0.4.xlsx",
    "Santosh_OKR_Checklist_Linked_0.3.xlsx",
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
