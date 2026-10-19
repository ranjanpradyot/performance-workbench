/** Workbook hyperlinks, in the form the Excel sheets store them. */

export type WorkbenchSection = "overview" | "kpis" | "checklist" | "tickets" | "quarters" | "learning" | "quality" | "scorecard" | "notes";

export interface WorkbookLink {
  raw: string;
  kind: "sheet" | "url" | "file";
  sheet?: string;
  cell?: string;
  /** 1-based worksheet row. Checklist line 1 is the header, so a link to row 1 has no OKR line. */
  row?: number;
  url?: string;
  section?: WorkbenchSection;
  quarterId?: string;
}

const SHEET_CELL = /^'?([^'!]+)'?!\$?([A-Za-z]+)\$?(\d+)$/;
const BARE_SHEET = /^[A-Za-z][A-Za-z0-9_]*$/;

export function parseWorkbookLink(raw: string): WorkbookLink {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return { raw: value, kind: "url", url: value };
  const cell = SHEET_CELL.exec(value);
  if (cell) {
    const sheet = cell[1];
    const row = Number(cell[3]);
    return { raw: value, kind: "sheet", sheet, cell: `${cell[2].toUpperCase()}${row}`, row, section: sectionForSheet(sheet), quarterId: quarterFromSheet(sheet) };
  }
  if (BARE_SHEET.test(value)) return { raw: value, kind: "sheet", sheet: value, section: sectionForSheet(value), quarterId: quarterFromSheet(value) };
  return { raw: value, kind: "file" };
}

const SHEET_NAMES: Array<[RegExp, string]> = [
  [/^Tickets_Master_/i, "Ticket master"],
  [/^Ticket_Velocity$/i, "Ticket velocity"],
  [/^Ticket_Spillover$/i, "Ticket spillover"],
  [/^FirstCut_Quality$/i, "First-cut quality"],
  [/^CodeChange_Summary$/i, "Code change summary"],
  [/^CodeChange_Tickets$/i, "Code change tickets"],
  [/^Helpdesk_Discipline$/i, "Helpdesk discipline"],
  [/^SLA_CycleDays$/i, "SLA cycle days"],
  [/^Customer_Defect_Themes$/i, "Customer defect themes"],
  [/^Rework_Reopen_Proxy$/i, "Rework and reopen"],
  [/^Learning_Evidence$/i, "Learning evidence"],
  [/^Actual_vs_Achieved_Scorecard$/i, "Scorecard"],
  [/^Document_Summary$/i, "Document summary"],
  [/^OKR_Checklist_Summary$/i, "OKR checklist summary"],
  [/^OKR_Summary$/i, "OKR summary"],
  [/_OKR_Checklist$/i, "OKR checklist"],
];

/** Plain-language name for a workbook sheet, without underscores or cell addresses. */
export function sheetLabel(sheet: string): string {
  const kpi = /^KPI_(\d{4})$/i.exec(sheet);
  if (kpi) return `${kpi[1]} KPIs`;
  const quarter = /^(Q[1-4]-\d{4})_(Tickets|Ticket_Summary)$/i.exec(sheet);
  if (quarter) return `${quarter[1].toUpperCase()} ${quarter[2].toLowerCase() === "tickets" ? "tickets" : "ticket summary"}`;
  const known = SHEET_NAMES.find(([pattern]) => pattern.test(sheet));
  if (known) return known[1];
  const words = sheet.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

function urlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    if (/helpdesk\./i.test(parsed.hostname) && /timesheet/i.test(parsed.pathname)) return "Helpdesk timesheet";
    if (/bitbucket\.org$/i.test(parsed.hostname)) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const repo = parts[1]?.replace(/-/g, " ");
      const tail = parts.slice(4).join(" / ");
      return ["Bitbucket", repo, tail].filter(Boolean).join(" · ");
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * What a person reads for a stored link. A checklist row reads as its OKR name when one is supplied.
 * The stored value is unchanged, so export still writes the workbook reference.
 */
export function linkLabel(link: WorkbookLink, okrTitle?: string): string {
  if (link.kind === "url" && link.url) return urlLabel(link.url);
  if (link.kind === "file") return `File · ${link.raw.split(/[/\\]/).pop() ?? link.raw}`;
  if (!link.sheet) return link.raw;
  if (link.section === "checklist") {
    if (link.row === 1) return "No OKR line yet";
    return okrTitle ? `OKR · ${okrTitle}` : `OKR checklist line ${(link.row ?? 2) - 1}`;
  }
  return sheetLabel(link.sheet);
}

/** Short OKR name: the phrase before the first colon, else the first words. */
export function okrTitle(text: string): string {
  const head = text.split(":")[0].trim();
  const base = head.length > 0 && head.length <= 48 ? head : text.trim();
  return base.length > 48 ? `${base.slice(0, 45).trimEnd()}…` : base;
}

function quarterFromSheet(sheet: string): string | undefined {
  const match = /Q([1-4])-(\d{4})/i.exec(sheet);
  if (!match) return undefined;
  return `q${match[1]}-${match[2]}`;
}

function sectionForSheet(sheet: string): WorkbenchSection {
  if (/_OKR_Checklist$/i.test(sheet)) return "checklist";
  if (/^KPI_\d{4}$/i.test(sheet)) return "kpis";
  if (/Learning_Evidence/i.test(sheet)) return "learning";
  if (/Scorecard/i.test(sheet)) return "scorecard";
  if (/Document_Summary/i.test(sheet)) return "notes";
  if (/Tickets|Ticket_Summary|Tickets_Master/i.test(sheet)) return "tickets";
  return "quality";
}
