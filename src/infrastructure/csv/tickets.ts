import { assignTicketQuarter, daysBetween, parseQuarterLabel, quarterLabel } from "@/domain/status";
import type { Ticket, WorkbenchDataset } from "@/domain/types";
import { upsertTicket } from "@/domain/mutations";
import { touchQuarter } from "@/infrastructure/excel/dataset";

export interface TicketCsvIssue {
  row: number;
  column: string;
  value: string;
  message: string;
  suggestion: string;
}

export interface TicketCsvPreview {
  ready: Ticket[];
  issues: TicketCsvIssue[];
}

const HEADER_MAP: Record<string, keyof Ticket | "skip"> = {
  "ticket no.": "ticketNo",
  "ticket no": "ticketNo",
  ticket: "ticketNo",
  description: "description",
  status: "status",
  month: "month",
  "assign date": "assignDate",
  "closure date": "closureDate",
  owner: "owner",
  "sp change": "spChange",
  "code change": "codeChange",
  "code lines changed": "codeLines",
  "code lines": "codeLines",
  "sql lines changed": "sqlLines",
  "sql lines": "sqlLines",
  quarter: "quarterId",
  "cycle days": "cycleDays",
  "azure_pr_url (manual)": "azurePrUrl",
  "azure_pr_url": "azurePrUrl",
};

export function previewTicketCsv(text: string, reporteeId: string, existing: Ticket[]): TicketCsvPreview {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { ready: [], issues: [{ row: 1, column: "file", value: "", message: "The paste is empty.", suggestion: "Paste a header row and at least one ticket." }] };
  }
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  if (!header.some((cell) => cell === "ticket no." || cell === "ticket no" || cell === "ticket")) {
    return { ready: [], issues: [{ row: 1, column: "Ticket No.", value: table[0].join(", "), message: "The header row does not include Ticket No.", suggestion: "Use the ticket master columns, starting with Ticket No." }] };
  }
  const issues: TicketCsvIssue[] = [];
  const ready: Ticket[] = [];
  const seen = new Set(existing.filter((item) => item.reporteeId === reporteeId).map((item) => `${item.ticketNo}|${item.quarterId ?? ""}`));
  table.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const record: Partial<Ticket> = { reporteeId, codeLines: null, sqlLines: null, cycleDays: null };
    let broken = false;
    header.forEach((name, index) => {
      const key = HEADER_MAP[name];
      if (!key || key === "skip") return;
      const value = cells[index] ?? "";
      if (key === "codeLines" || key === "sqlLines" || key === "cycleDays") {
        const parsed = optionalNumber(value, name, rowNumber, issues);
        if (parsed === "invalid") broken = true;
        else record[key] = parsed;
        return;
      }
      if (key === "assignDate" || key === "closureDate" || key === "month") {
        const parsed = optionalDate(value, name, rowNumber, issues);
        if (parsed === "invalid") broken = true;
        else record[key] = parsed;
        return;
      }
      if (key === "quarterId") {
        if (!value.trim()) return;
        const parsed = parseQuarterLabel(value);
        if (!parsed) {
          broken = true;
          issues.push({ row: rowNumber, column: "Quarter", value, message: "The quarter label was not recognised.", suggestion: "Use a label such as Q3-2026." });
        } else record.quarterId = parsed.id;
        return;
      }
      if (value.trim() && (key === "ticketNo" || key === "description" || key === "status" || key === "owner" || key === "spChange" || key === "codeChange" || key === "azurePrUrl")) {
        record[key] = value.trim();
      }
    });
    if (!record.ticketNo || !/^\d+$/.test(record.ticketNo)) {
      issues.push({ row: rowNumber, column: "Ticket No.", value: record.ticketNo ?? "", message: "Ticket number is missing or is not numeric.", suggestion: "Enter the numeric ticket id from the source system." });
      return;
    }
    if (broken) return;
    record.quarterId = assignTicketQuarter({ quarterId: record.quarterId, closureDate: record.closureDate, month: record.month, assignDate: record.assignDate });
    if (record.assignDate && record.closureDate && record.cycleDays == null) {
      record.cycleDays = daysBetween(record.assignDate, record.closureDate);
    }
    const key = `${record.ticketNo}|${record.quarterId ?? ""}`;
    if (seen.has(key)) {
      issues.push({ row: rowNumber, column: "Ticket No.", value: record.ticketNo, message: `Ticket ${record.ticketNo} is already present for ${record.quarterId ? quarterLabel(record.quarterId) : "an unassigned quarter"}.`, suggestion: "Edit the existing ticket, or change the quarter if this is a later appearance of the same number." });
      return;
    }
    seen.add(key);
    ready.push({
      id: `tkt_${reporteeId}_${record.ticketNo}${record.quarterId ? `_${record.quarterId}` : ""}`,
      reporteeId,
      ticketNo: record.ticketNo,
      description: record.description,
      status: record.status,
      month: record.month,
      assignDate: record.assignDate,
      closureDate: record.closureDate,
      owner: record.owner,
      spChange: record.spChange,
      codeChange: record.codeChange,
      codeLines: record.codeLines ?? null,
      sqlLines: record.sqlLines ?? null,
      quarterId: record.quarterId,
      cycleDays: record.cycleDays ?? null,
      azurePrUrl: record.azurePrUrl,
      updatedAt: new Date().toISOString(),
    });
  });
  return { ready, issues };
}

export function commitTicketRows(dataset: WorkbenchDataset, rows: Ticket[]): WorkbenchDataset {
  const next = structuredClone(dataset);
  for (const ticket of rows) {
    if (ticket.quarterId) {
      const parsed = parseQuarterLabel(quarterLabel(ticket.quarterId));
      if (parsed && !next.quarters.some((item) => item.id === parsed.id)) touchQuarter(next, parsed.year, parsed.quarterNumber);
    }
    const saved = upsertTicket(next, ticket);
    next.tickets = saved.tickets;
    next.quarters = saved.quarters;
    next.appraisalYears = saved.appraisalYears;
    next.auditHistory = saved.auditHistory;
  }
  return next;
}

function optionalNumber(value: string, column: string, row: number, issues: TicketCsvIssue[]): number | null | "invalid" {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) {
    issues.push({ row, column, value, message: `${column} is not a number.`, suggestion: "Enter 0 or a positive number, or leave the cell blank when the count is unknown. Blank is not zero." });
    return "invalid";
  }
  return Number(text);
}

function optionalDate(value: string, column: string, row: number, issues: TicketCsvIssue[]): string | undefined | "invalid" {
  const text = value.trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`))) return text;
  issues.push({
    row,
    column,
    value,
    message: `${column} is not a calendar date.`,
    suggestion: /^\d{4,6}(\.\d+)?$/.test(text) ? "This looks like an Excel date serial. Format it as YYYY-MM-DD before pasting." : "Use YYYY-MM-DD.",
  });
  return "invalid";
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === "\"") {
        if (source[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value));
}
