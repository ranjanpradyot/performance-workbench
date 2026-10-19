import type ExcelJS from "exceljs";

export interface ParsedCell {
  text: string | null;
  number: number | null;
  date: string | null;
  formula?: string;
  link?: string;
  raw?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function richText(value: ExcelJS.CellValue): string | null {
  if (value && typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }
  return null;
}

export function parseCell(cell: ExcelJS.Cell | undefined): ParsedCell {
  const empty: ParsedCell = { text: null, number: null, date: null };
  if (!cell || cell.value == null || cell.value === "") return empty;
  const value = cell.value;
  const link = typeof cell.hyperlink === "string" ? cell.hyperlink : undefined;

  if (value instanceof Date) {
    const date = formatLocalDate(value);
    return { text: date, number: null, date, link };
  }
  if (typeof value === "number") {
    return { text: String(value), number: value, date: null, link };
  }
  if (typeof value === "boolean") {
    return { text: value ? "Yes" : "No", number: null, date: null, link };
  }
  if (typeof value === "string") {
    const text = value.trim();
    return { text: text || null, number: null, date: null, link };
  }
  if (typeof value === "object") {
    if ("formula" in value && value.formula) {
      const result = "result" in value ? value.result : undefined;
      const parsed = parseResult(result);
      return { ...parsed, formula: String(value.formula), link };
    }
    if ("text" in value && "hyperlink" in value) {
      const text = String(value.text ?? "").trim();
      const href = typeof value.hyperlink === "string" ? value.hyperlink : link;
      return { text: text || href || null, number: null, date: null, link: href };
    }
    const rich = richText(value);
    if (rich) {
      const text = rich.trim();
      return { text: text || null, number: null, date: null, link };
    }
    if ("result" in value) {
      return { ...parseResult(value.result), link };
    }
  }
  return { text: String(value), number: null, date: null, raw: String(value), link };
}

function parseResult(result: unknown): ParsedCell {
  if (result == null || result === "") return { text: null, number: null, date: null };
  if (result instanceof Date) {
    const date = formatLocalDate(result);
    return { text: date, number: null, date };
  }
  if (typeof result === "number") return { text: String(result), number: result, date: null };
  if (typeof result === "object" && result && "error" in result) {
    return { text: null, number: null, date: null, raw: `#${String((result as { error: string }).error)}` };
  }
  const text = String(result).trim();
  return { text: text || null, number: null, date: null };
}

export function sheetRows(worksheet: ExcelJS.Worksheet, maxColumns = 30): ParsedCell[][] {
  const rows: ParsedCell[][] = [];
  const last = Math.max(worksheet.rowCount, worksheet.actualRowCount);
  for (let rowNumber = 1; rowNumber <= last; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cells: ParsedCell[] = [];
    let any = false;
    for (let column = 1; column <= maxColumns; column += 1) {
      const parsed = parseCell(row.getCell(column));
      if (parsed.text != null || parsed.formula || parsed.link) any = true;
      cells.push(parsed);
    }
    if (any) rows.push(cells);
    else rows.push([]);
  }
  return rows;
}

export function cellText(row: ParsedCell[] | undefined, index: number): string | null {
  return row?.[index]?.text ?? null;
}

export function headerIndex(header: ParsedCell[], names: string[]): number {
  const wanted = names.map((name) => name.trim().toLowerCase());
  return header.findIndex((cell) => wanted.includes((cell.text ?? "").trim().toLowerCase()));
}

export function findHeader(rows: ParsedCell[][], required: string[]): number {
  const needles = required.map((item) => item.toLowerCase());
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const texts = rows[index].map((cell) => (cell.text ?? "").trim().toLowerCase());
    if (needles.every((needle) => texts.includes(needle))) return index;
  }
  return -1;
}
