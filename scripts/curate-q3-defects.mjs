/**
 * Curate Q3-2026 defect-like flags for Utkarsh and Krishna the same way Q1 and Q2 were curated.
 *
 * A ticket is defect-like when a prior quarter already marked that description Yes, or when it is
 * the same kind of failure those Yes rows are: hanging, an error, a wrong value, or a break that
 * stops the user. Duplicate parts, extra parts, discrepancies, missing structure, "not showing",
 * updates, and rollouts stayed No in Q1 and Q2, so they stay No here.
 *
 * Threshold remains <= 4. Both quarters are inside it, so Quality Q3Achieved becomes Yes.
 */
import ExcelJS from "exceljs";
import path from "node:path";

const YES = {
  Utkarsh: new Set(["18760", "42241", "44859"]),
  Krishna: new Set(["16788", "24084"]),
};

const COMMENT = {
  Utkarsh: "Within <=4 threshold. Curated like Q1 and Q2: hanging, cannot-expand, and login failure. Extra parts, missing structure, updates, and rollouts are not defect-like.",
  Krishna: "Within <=4 defect-theme threshold. Curated like Q1 and Q2: missing parts and the error-message ticket. Tickets already marked No in Q2 stay No.",
};

const CLOSED = new Set(["closed", "resolved"]);

function text(value) {
  if (value == null) return "";
  if (typeof value === "object" && value.richText) return value.richText.map((part) => part.text).join("");
  if (typeof value === "object" && value.text) return String(value.text);
  if (typeof value === "object" && value.result != null) return String(value.result);
  return String(value);
}

function personOf(file) {
  if (file.startsWith("Utkarsh")) return "Utkarsh";
  if (file.startsWith("Krishna")) return "Krishna";
  throw new Error(file);
}

async function curate(file) {
  const person = personOf(file);
  const book = new ExcelJS.Workbook();
  const full = path.resolve("fixtures/workbooks", file);
  await book.xlsx.readFile(full);
  const master = book.worksheets.find((sheet) => sheet.name.startsWith("Tickets_Master"));
  const closed = [];
  master.eachRow((row) => {
    if (text(row.getCell(12).value) !== "Q3-2026") return;
    const ticketNo = text(row.getCell(1).value);
    if (!/^\d+$/.test(ticketNo)) return;
    const status = text(row.getCell(3).value);
    if (!CLOSED.has(status.toLowerCase())) return;
    closed.push({ ticketNo, status, description: text(row.getCell(2).value) });
  });
  closed.sort((a, b) => Number(a.ticketNo) - Number(b.ticketNo));
  const flagged = closed.filter((ticket) => YES[person].has(ticket.ticketNo));
  if (flagged.length !== YES[person].size) {
    throw new Error(`${person} is missing a Yes ticket. Found ${flagged.map((ticket) => ticket.ticketNo).join(", ")}`);
  }

  const defects = book.getWorksheet("Customer_Defect_Themes");
  let summaryRow = 0;
  let detailHeader = 0;
  let lastDetail = 0;
  defects.eachRow((row, rowNumber) => {
    if (text(row.getCell(1).value) === "Q3-2026" && summaryRow === 0) summaryRow = rowNumber;
    if (text(row.getCell(1).value) === "Ticket No." && text(row.getCell(5).value).toLowerCase().startsWith("defect-like")) detailHeader = rowNumber;
    if (detailHeader && rowNumber > detailHeader && /^\d+$/.test(text(row.getCell(1).value))) lastDetail = rowNumber;
  });
  if (!summaryRow || !detailHeader) throw new Error(`${person} defect sheet layout was not found`);
  const already = [];
  defects.eachRow((row, rowNumber) => {
    if (rowNumber > detailHeader && text(row.getCell(2).value) === "Q3-2026") already.push(rowNumber);
  });
  if (already.length) throw new Error(`${person} already has Q3 defect rows at ${already.join(", ")}`);

  defects.getCell(summaryRow, 3).value = flagged.length;
  defects.getCell(summaryRow, 4).value = flagged.length <= 4 ? "Yes" : "No";
  defects.getCell(summaryRow, 5).value = flagged.map((ticket) => ticket.ticketNo).join(", ");
  defects.getCell(summaryRow, 6).value = COMMENT[person];

  const styleRow = defects.getRow(lastDetail);
  closed.forEach((ticket, index) => {
    const row = defects.getRow(lastDetail + 1 + index);
    const values = [Number(ticket.ticketNo), "Q3-2026", ticket.status, ticket.description, YES[person].has(ticket.ticketNo) ? "Yes" : "No"];
    values.forEach((value, column) => {
      const cell = row.getCell(column + 1);
      cell.value = value;
      cell.style = styleRow.getCell(column + 1).style;
    });
  });

  const kpi = book.getWorksheet("KPI_2026");
  const kpiName = text(kpi.getCell(3, 1).value);
  if (!/^Quality$/i.test(kpiName)) throw new Error(`${person} KPI row 3 is ${kpiName}`);
  const closedCount = text(kpi.getCell(3, 15).value).match(/Closed=(\d+)/)?.[1];
  kpi.getCell(3, 15).value = `Closed=${closedCount ?? closed.length}; defect-themes=${flagged.length}; rework-proxy=0 (0.0%)`;
  kpi.getCell(3, 16).value = "Yes";

  const summary = book.getWorksheet("Q3-2026_Ticket_Summary");
  summary.eachRow((row) => {
    if (text(row.getCell(1).value) !== "Defect-like themes") return;
    row.getCell(2).value = flagged.length;
    row.getCell(3).value = "Yes";
  });

  const document = book.getWorksheet("Document_Summary");
  const note = document.getRow(document.actualRowCount + 1);
  note.getCell(1).value = "0.4";
  note.getCell(2).value = "Q3 defects";
  note.getCell(3).value = `Q3-2026 defect-like flags curated like Q1 and Q2. ${flagged.length} theme${flagged.length === 1 ? "" : "s"} (${flagged.map((ticket) => ticket.ticketNo).join(", ")}). Threshold <=4, so Quality is Yes.`;
  note.getCell(3).alignment = { wrapText: true };

  restoreSheetLinks(book);
  await book.xlsx.writeFile(full);
  console.log(person, "closed", closed.length, "defect-like", flagged.map((ticket) => ticket.ticketNo).join(", "));
}

function restoreSheetLinks(book) {
  book.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.hyperlink) return;
        const value = text(cell.value);
        const internal = value.match(/^('?[^'!]+'?)!([A-Z]+\d+)$/);
        const url = /^https?:\/\//i.test(value);
        if (!internal && !url) return;
        const hyperlink = internal ? `#'${internal[1].replace(/^'|'$/g, "")}'!${internal[2]}` : value;
        cell.value = { text: value, hyperlink };
        cell.font = { name: cell.font?.name ?? "Calibri", size: cell.font?.size, color: { argb: "FF0563C1" }, underline: true };
      });
    });
  });
}

if (process.argv.includes("--links")) {
  for (const file of ["Utkarsh_OKR_Checklist_Linked_0.4.xlsx", "Krishna_OKR_Checklist_Linked_0.4.xlsx"]) {
    const book = new ExcelJS.Workbook();
    const full = path.resolve("fixtures/workbooks", file);
    await book.xlsx.readFile(full);
    restoreSheetLinks(book);
    await book.xlsx.writeFile(full);
    console.log("restored links", file);
  }
}

if (!process.argv.includes("--links")) {
  await curate("Utkarsh_OKR_Checklist_Linked_0.4.xlsx");
  await curate("Krishna_OKR_Checklist_Linked_0.4.xlsx");
}
