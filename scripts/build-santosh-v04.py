"""Build Santosh v0.4 from v0.3 by folding in the Q3-2026 ticket tracker.

Copies the Q2 ticket sheet and summary so layout, column widths, and the
checklist hyperlink stay the same. Does not invent dates, employee IDs, or
Q3 KPI Yes/No scores. Blank tracker cells do not wipe values already stored.
"""

from __future__ import annotations

import shutil
from copy import copy
from datetime import datetime
from pathlib import Path

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "fixtures" / "workbooks" / "Santosh_OKR_Checklist_Linked_0.3.xlsx"
TARGET = ROOT / "fixtures" / "workbooks" / "Santosh_OKR_Checklist_Linked_0.4.xlsx"
TRACKER = Path(r"c:\Users\pradyot\Downloads\Santhosh_Q3_TicketTracker\Santhosh_Q3_2026_Ticket_Tracker.xlsx")
QUARTER = "Q3-2026"
APPRAISAL = {"Q3-2025", "Q4-2025", "Q1-2026", "Q2-2026"}
CHECKLIST = "Santosh_OKR_Checklist!A1"


def yes(value) -> bool:
    return isinstance(value, str) and value.strip().lower().startswith("y")


def closed(value) -> bool:
    return str(value or "").strip().lower() in {"closed", "resolved"}


def as_number(value):
    if isinstance(value, bool) or value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return value
    return None


def ticket_no(value) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    return str(value or "").strip()


def header_map(sheet: Worksheet, row: int) -> dict[str, int]:
    found = {}
    for cell in sheet[row]:
        if cell.value:
            found[str(cell.value).strip()] = cell.column
    return found


def read_tracker() -> list[dict]:
    book = openpyxl.load_workbook(TRACKER, data_only=True)
    sheet = book[book.sheetnames[0]]
    headers = header_map(sheet, 2)
    rows = []
    for row in range(3, sheet.max_row + 1):
        number = ticket_no(sheet.cell(row, headers["Ticket No."]).value)
        if not number.isdigit():
            continue
        rows.append(
            {
                "ticketNo": number,
                "description": sheet.cell(row, headers["Description"]).value,
                "user": sheet.cell(row, headers["User"]).value,
                "status": sheet.cell(row, headers["Status"]).value,
                "codeLines": as_number(sheet.cell(row, headers["Lines Of Code Changed"]).value),
                "sqlLines": as_number(sheet.cell(row, headers["Lines of Code(SQL)"]).value),
                "dataIssue": sheet.cell(row, headers["Data Issue"]).value,
            }
        )
    return rows


def find_header(sheet: Worksheet, first: str, also: str | None = None) -> int:
    for row in range(1, sheet.max_row + 1):
        if sheet.cell(row, 1).value == first and (also is None or sheet.cell(row, 2).value == also or sheet.cell(row, 3).value == also or sheet.cell(row, 4).value == also):
            return row
    raise RuntimeError(f"Header {first} not found on {sheet.title}")


def master_rows(sheet: Worksheet) -> dict[str, int]:
    header = find_header(sheet, "Ticket No.", "Description")
    found = {}
    for row in range(header + 1, sheet.max_row + 1):
        number = ticket_no(sheet.cell(row, 1).value)
        if number.isdigit():
            found[number] = row
    return found


def copy_style(source, target) -> None:
    if source.has_style:
        target.font = copy(source.font)
        target.border = copy(source.border)
        target.fill = copy(source.fill)
        target.number_format = source.number_format
        target.alignment = copy(source.alignment)


def style_row(sheet: Worksheet, source_row: int, target_row: int, columns: int) -> None:
    for column in range(1, columns + 1):
        copy_style(sheet.cell(source_row, column), sheet.cell(target_row, column))
    height = sheet.row_dimensions[source_row].height
    if height:
        sheet.row_dimensions[target_row].height = height


def upsert_master(sheet: Worksheet, tracker: list[dict]) -> None:
    rows = master_rows(sheet)
    header = find_header(sheet, "Ticket No.", "Description")
    last = max(rows.values())
    for item in tracker:
        row = rows.get(item["ticketNo"])
        if row is None:
            row = sheet.max_row + 1
            style_row(sheet, last, row, 13)
            sheet.cell(row, 1).value = item["ticketNo"]
            sheet.cell(row, 12).value = QUARTER
        sheet.cell(row, 2).value = item["description"]
        sheet.cell(row, 3).value = item["status"]
        if item["user"]:
            sheet.cell(row, 7).value = item["user"]
        sheet.cell(row, 12).value = QUARTER
        if item["codeLines"] is not None:
            sheet.cell(row, 10).value = item["codeLines"]
            if item["codeLines"] > 0 and not yes(sheet.cell(row, 9).value):
                sheet.cell(row, 9).value = "Yes"
        # Tracker SQL is blank for every row. A blank is not a zero, so stored SQL stays.
        if item["sqlLines"] is not None:
            sheet.cell(row, 11).value = item["sqlLines"]
    if header < 1:
        raise RuntimeError("master header missing")


def read_master(sheet: Worksheet) -> list[dict]:
    rows = []
    for row in range(find_header(sheet, "Ticket No.", "Description") + 1, sheet.max_row + 1):
        number = ticket_no(sheet.cell(row, 1).value)
        if not number.isdigit():
            continue
        rows.append(
            {
                "ticketNo": number,
                "description": sheet.cell(row, 2).value,
                "status": sheet.cell(row, 3).value,
                "month": sheet.cell(row, 4).value,
                "assign": sheet.cell(row, 5).value,
                "closure": sheet.cell(row, 6).value,
                "owner": sheet.cell(row, 7).value,
                "sp": sheet.cell(row, 8).value,
                "code": sheet.cell(row, 9).value,
                "codeLines": as_number(sheet.cell(row, 10).value),
                "sqlLines": as_number(sheet.cell(row, 11).value),
                "quarter": sheet.cell(row, 12).value,
                "cycle": as_number(sheet.cell(row, 13).value),
            }
        )
    return rows


def summarize(tickets: list[dict]) -> dict:
    closed_rows = [ticket for ticket in tickets if closed(ticket["status"])]
    open_rows = [ticket for ticket in tickets if not closed(ticket["status"])]
    cycles = [ticket["cycle"] for ticket in closed_rows if ticket["cycle"] is not None]
    code_or_sp = [ticket for ticket in tickets if yes(ticket["code"]) or yes(ticket["sp"])]
    total = len(tickets)
    spill = round(len(open_rows) / total * 100, 1) if total else 0
    return {
        "total": total,
        "closed": len(closed_rows),
        "open": len(open_rows),
        "openNos": [ticket["ticketNo"] for ticket in open_rows],
        "spill": spill,
        "code": sum(yes(ticket["code"]) for ticket in tickets),
        "sp": sum(yes(ticket["sp"]) for ticket in tickets),
        "codeLines": sum(ticket["codeLines"] or 0 for ticket in tickets),
        "sqlLines": sum(ticket["sqlLines"] or 0 for ticket in tickets),
        "avg": round(sum(cycles) / len(cycles), 1) if cycles else None,
        "max": max(cycles) if cycles else None,
        "datedClosed": len(cycles),
        "codeSp": len(code_or_sp),
        "codeSpClosed": sum(closed(ticket["status"]) for ticket in code_or_sp),
        "codeSpLines": sum(ticket["codeLines"] or 0 for ticket in code_or_sp),
        "codeSpSql": sum(ticket["sqlLines"] or 0 for ticket in code_or_sp),
    }


def fill_ticket_sheet(sheet: Worksheet, tickets: list[dict], title: str) -> None:
    sheet["A3"].value = title
    start = 6
    for index, ticket in enumerate(tickets):
        row = start + index
        if row > 6:
            style_row(sheet, 6, row, 13)
        values = [
            ticket["ticketNo"],
            ticket["description"],
            ticket["status"],
            ticket["month"],
            ticket["assign"],
            ticket["closure"],
            ticket["owner"],
            ticket["sp"],
            ticket["code"],
            ticket["codeLines"],
            ticket["sqlLines"],
            ticket["quarter"],
            ticket["cycle"],
        ]
        for column, value in enumerate(values, 1):
            cell = sheet.cell(row, column)
            cell.value = value
            if column in {4, 5, 6} and isinstance(value, datetime):
                cell.number_format = sheet.cell(6, column).number_format
    last = start + len(tickets) - 1
    if sheet.max_row > last:
        sheet.delete_rows(last + 1, sheet.max_row - last)


def set_summary(sheet: Worksheet, title: str, stats: dict, delivery, closed_mark: str) -> None:
    sheet["A3"].value = title
    spill_mark = "Yes" if stats["open"] <= 2 or stats["spill"] <= 20 else "No"
    values = {
        "Total tickets": (stats["total"], None),
        "Closed/Resolved": (stats["closed"], closed_mark),
        "Open / spill": (stats["open"], spill_mark),
        "Spill %": (stats["spill"], spill_mark),
        "Code Change tickets": (stats["code"], "Yes"),
        "SP Change tickets": (stats["sp"], "Yes"),
        "Code Lines": (stats["codeLines"], None),
        "SQL Lines": (stats["sqlLines"], None),
        "Avg Cycle Days": (stats["avg"], "Yes" if stats["avg"] is not None else None),
        "Defect-like themes": None,  # filled by caller when it should change
        "Rework proxy count": None,
        "Delivery target": (delivery, None),
    }
    for row in range(6, sheet.max_row + 1):
        label = sheet.cell(row, 1).value
        if label not in values or values[label] is None:
            continue
        number, mark = values[label]
        sheet.cell(row, 2).value = number
        if mark is not None:
            sheet.cell(row, 3).value = mark


def find_label(sheet: Worksheet, label: str) -> int | None:
    for row in range(1, sheet.max_row + 1):
        if sheet.cell(row, 1).value == label:
            return row
    return None


def write_row(sheet: Worksheet, row: int, values: list) -> None:
    for column, value in enumerate(values, 1):
        sheet.cell(row, column).value = value


def ensure_quarter_row(sheet: Worksheet, values: list) -> None:
    existing = find_label(sheet, QUARTER)
    if existing:
        write_row(sheet, existing, values)
        return
    source = None
    for row in range(1, sheet.max_row + 1):
        label = sheet.cell(row, 1).value
        if isinstance(label, str) and label.startswith("Q"):
            source = row
    target = (source or sheet.max_row) + 1
    if sheet.cell(target, 1).value:
        sheet.insert_rows(target)
    if source:
        style_row(sheet, source, target, max(len(values), 7))
    write_row(sheet, target, values)


def remove_ticket_row(sheet: Worksheet, number: str) -> None:
    header = find_header(sheet, "Ticket No.")
    for row in range(sheet.max_row, header, -1):
        if ticket_no(sheet.cell(row, 1).value) == number:
            sheet.delete_rows(row, 1)


def update_code_sheet(sheet: Worksheet, tickets: list[dict]) -> None:
    header = find_header(sheet, "Ticket No.", "Quarter")
    by_number = {}
    for row in range(header + 1, sheet.max_row + 1):
        number = ticket_no(sheet.cell(row, 1).value)
        if number.isdigit():
            by_number[number] = row
    wanted = [ticket for ticket in tickets if ticket["quarter"] == QUARTER and (yes(ticket["code"]) or yes(ticket["sp"]))]
    for ticket in wanted:
        row = by_number.get(ticket["ticketNo"])
        if row is None:
            row = sheet.max_row + 1
            style_row(sheet, sheet.max_row, row, 11)
        sheet.cell(row, 1).value = ticket["ticketNo"]
        sheet.cell(row, 2).value = ticket["description"]
        sheet.cell(row, 3).value = ticket["status"]
        sheet.cell(row, 4).value = ticket["quarter"]
        sheet.cell(row, 5).value = ticket["code"]
        sheet.cell(row, 6).value = ticket["sp"]
        sheet.cell(row, 7).value = ticket["codeLines"]
        sheet.cell(row, 8).value = ticket["sqlLines"]
        if isinstance(ticket["assign"], datetime):
            sheet.cell(row, 9).value = ticket["assign"]
            sheet.cell(row, 9).number_format = sheet.cell(header + 1, 9).number_format
        if isinstance(ticket["closure"], datetime):
            sheet.cell(row, 10).value = ticket["closure"]
            sheet.cell(row, 10).number_format = sheet.cell(header + 1, 10).number_format


def velocity_mark(closed_count: int, target: int) -> str:
    return "Yes" if closed_count >= target or closed_count >= int(target * 0.7) else "No"


def hyperlink_count(book) -> int:
    return sum(len(sheet.hyperlinks) for sheet in book.worksheets if hasattr(sheet, "hyperlinks"))


def main() -> None:
    tracker = read_tracker()
    if len(tracker) != 10:
        raise SystemExit(f"Expected 10 tracker tickets, found {len(tracker)}")
    shutil.copyfile(SOURCE, TARGET)
    book = openpyxl.load_workbook(TARGET)
    before_links = hyperlink_count(book)
    master = book["Tickets_Master_Santosh"]
    upsert_master(master, tracker)
    tickets = read_master(master)
    by_quarter: dict[str, list[dict]] = {}
    for ticket in tickets:
        by_quarter.setdefault(ticket["quarter"], []).append(ticket)
    q3 = by_quarter[QUARTER]
    if len(q3) != 10 or len(tickets) != 50:
        raise SystemExit(f"Master has {len(tickets)} tickets and {len(q3)} in {QUARTER}")

    q3_tickets = book.copy_worksheet(book["Q2-2026_Tickets"])
    q3_tickets.title = "Q3-2026_Tickets"
    fill_ticket_sheet(q3_tickets, q3, "Q3-2026 — ticket evidence pack (from Tickets_Master_Santosh)")
    q3_summary = book.copy_worksheet(book["Q2-2026_Ticket_Summary"])
    q3_summary.title = "Q3-2026_Ticket_Summary"
    q3_stats = summarize(q3)
    set_summary(q3_summary, "Q3-2026 Summary", q3_stats, 15, "No")
    # Defect-like count is the tracker Data Issue flag, which has no column on the ticket sheet.
    data_issue = [item["ticketNo"] for item in tracker if yes(item["dataIssue"])]
    for row in range(6, q3_summary.max_row + 1):
        if q3_summary.cell(row, 1).value == "Defect-like themes":
            q3_summary.cell(row, 2).value = len(data_issue)
            q3_summary.cell(row, 3).value = "Yes" if len(data_issue) <= 4 else "No"

    remove_ticket_row(book["Q2-2026_Tickets"], "43310")
    remove_ticket_row(book["Q4-2025_Tickets"], "25685")
    q2 = summarize(by_quarter["Q2-2026"])
    q4 = summarize(by_quarter["Q4-2025"])
    q4_2024 = summarize(by_quarter.get("Q4-2024", []))
    set_summary(book["Q2-2026_Ticket_Summary"], "Q2-2026 Summary", q2, 9, velocity_mark(q2["closed"], 12))
    set_summary(book["Q4-2025_Ticket_Summary"], "Q4-2025 Summary", q4, 9, velocity_mark(q4["closed"], 9))

    velocity = book["Ticket_Velocity"]
    write_row(velocity, find_label(velocity, "Q2-2026"), ["Q2-2026", q2["total"], q2["closed"], q2["open"], 12, velocity_mark(q2["closed"], 12), f"Below target ({q2['closed']}/12)", "Tickets_Master_Santosh"])
    write_row(velocity, find_label(velocity, "Q4-2025"), ["Q4-2025", q4["total"], q4["closed"], q4["open"], 9, velocity_mark(q4["closed"], 9), f"Met 70% threshold ({q4['closed']}/9)", "Tickets_Master_Santosh"])
    write_row(velocity, find_label(velocity, "Q4-2024"), ["Q4-2024", q4_2024["total"], q4_2024["closed"], q4_2024["open"], "—", "—", "Outside appraisal scope", "Tickets_Master_Santosh"])
    q3_velocity = find_label(velocity, QUARTER)
    velocity.cell(q3_velocity, 2).value = q3_stats["total"]
    velocity.cell(q3_velocity, 3).value = q3_stats["closed"]
    velocity.cell(q3_velocity, 4).value = q3_stats["open"]

    def totals(rows: list[dict]) -> list:
        stats = summarize(rows)
        return [stats["total"], stats["closed"], stats["open"], stats["code"], stats["sp"], stats["codeLines"], stats["sqlLines"]]

    all_totals = totals(tickets)
    appraisal = [ticket for ticket in tickets if ticket["quarter"] in APPRAISAL]
    appraisal_totals = totals(appraisal)
    write_row(velocity, find_label(velocity, "All master tickets"), ["All master tickets", *all_totals])
    appraisal_row = find_label(velocity, "Appraisal only (Q3-2025..Q2-2026)")
    write_row(velocity, appraisal_row, ["Appraisal only (Q3-2025..Q2-2026)", *appraisal_totals])

    spill = book["Ticket_Spillover"]
    for label, stats in (("Q2-2026", q2), ("Q4-2025", q4), ("Q4-2024", q4_2024)):
        mark = "Yes" if stats["open"] <= 2 or stats["spill"] <= 20 else "No"
        write_row(spill, find_label(spill, label), [label, stats["total"], stats["open"], stats["spill"], mark, ", ".join(stats["openNos"]) or "-", "Achieved if open<=2 or spill%<=20"])
    q3_spill_mark = "Yes" if q3_stats["open"] <= 2 or q3_stats["spill"] <= 20 else "No"
    ensure_quarter_row(spill, [QUARTER, q3_stats["total"], q3_stats["open"], q3_stats["spill"], q3_spill_mark, ", ".join(q3_stats["openNos"]) or "-", "Achieved if open<=2 or spill%<=20"])

    first = book["FirstCut_Quality"]
    comment = "Quality Achieved — proxy; attach Azure PR screenshots if available"
    write_row(first, find_label(first, "Q2-2026"), ["Q2-2026", q2["codeSp"], q2["codeSpClosed"], q2["codeSpLines"], q2["codeSpSql"], "Yes", comment])
    write_row(first, find_label(first, "Q4-2025"), ["Q4-2025", q4["codeSp"], q4["codeSpClosed"], q4["codeSpLines"], q4["codeSpSql"], "Yes", comment])
    ensure_quarter_row(first, [QUARTER, q3_stats["codeSp"], q3_stats["codeSpClosed"], q3_stats["codeSpLines"], q3_stats["codeSpSql"], "Yes", comment])

    code_summary = book["CodeChange_Summary"]
    write_row(code_summary, find_label(code_summary, "Q2-2026"), ["Q2-2026", q2["code"], q2["sp"], q2["codeLines"], q2["sqlLines"], "Yes", "PR rejection = 0 (0%). Threshold <10%. Achieved.", 0, "Yes"])
    write_row(code_summary, find_label(code_summary, "Q4-2025"), ["Q4-2025", q4["code"], q4["sp"], q4["codeLines"], q4["sqlLines"], "Yes", "PR rejection = 0 (0%). Threshold <10%. Achieved.", 0, "Yes"])
    ensure_quarter_row(code_summary, [QUARTER, q3_stats["code"], q3_stats["sp"], q3_stats["codeLines"], q3_stats["sqlLines"], "—", "Outside appraisal scope. PR rejection was not on the Q3 tracker."])

    sla = book["SLA_CycleDays"]
    # Recorded Yes stays on quarters that were already assessed, even when the average is over 45.
    sla.cell(find_label(sla, "Q2-2026"), 2).value = q2["closed"]
    sla.cell(find_label(sla, "Q2-2026"), 3).value = q2["avg"]
    sla.cell(find_label(sla, "Q2-2026"), 4).value = q2["max"]
    ensure_quarter_row(
        sla,
        [
            QUARTER,
            q3_stats["closed"],
            q3_stats["avg"],
            q3_stats["max"],
            "Yes" if q3_stats["avg"] is not None and q3_stats["avg"] <= 45 else "No",
            f"Average of {q3_stats['datedClosed']} closed tickets that have both dates. {q3_stats['closed'] - q3_stats['datedClosed']} closed tickets have no assign or closure date on the tracker.",
        ],
    )

    defects = book["Customer_Defect_Themes"]
    defects.cell(find_label(defects, "Q2-2026"), 2).value = q2["closed"]
    ensure_quarter_row(
        defects,
        [
            QUARTER,
            q3_stats["closed"],
            len(data_issue),
            "Yes" if len(data_issue) <= 4 else "No",
            ", ".join(data_issue) or "-",
            "Data Issue = Yes on the Q3-2026 tracker. Threshold <=4.",
        ],
    )

    rework = book["Rework_Reopen_Proxy"]
    rework.cell(find_label(rework, "Q2-2026"), 2).value = q2["total"]
    rework.cell(find_label(rework, "Q4-2025"), 2).value = q4["total"]
    rework_hits = [ticket["ticketNo"] for ticket in q3 if "rework" in str(ticket["description"]).lower() or "reopen" in str(ticket["description"]).lower() or "re-open" in str(ticket["description"]).lower()]
    ensure_quarter_row(rework, [QUARTER, q3_stats["total"], len(rework_hits), 0 if not q3_stats["total"] else round(len(rework_hits) / q3_stats["total"] * 100, 1), "Yes" if not q3_stats["total"] or len(rework_hits) / q3_stats["total"] < 0.05 else "No", ", ".join(rework_hits) or "-"])

    update_code_sheet(book["CodeChange_Tickets"], tickets)

    scorecard = book["Actual_vs_Achieved_Scorecard"]
    write_row(scorecard, find_label(scorecard, "All master"), ["All master", *all_totals[:6]])
    write_row(scorecard, find_label(scorecard, "Appraisal only"), ["Appraisal only", *appraisal_totals[:6]])

    document = book["Document_Summary"]
    note_row = document.max_row + 1
    style_row(document, document.max_row, note_row, 3)
    document.cell(note_row, 1).value = "0.4"
    document.cell(note_row, 2).value = "Tickets"
    document.cell(note_row, 3).value = (
        "Q3-2026 ticket tracker included (10 tickets) on Tickets_Master_Santosh, Q3-2026_Tickets, and Q3-2026_Ticket_Summary. "
        "New tickets 45359 and 43681 have no assign or closure date, so cycle days stay blank. "
        "43310 moves from Q2-2026, 16797 from Q4-2024, and 25685 from Q4-2025. "
        "Code lines follow the tracker where a number is present. SQL lines stay as previously stored because the tracker SQL column is blank. "
        "Data Issue = Yes for 45359, 41696, and 43681. Q3-2026 stays outside the appraisal score, and Q3 KPI actuals stay blank."
    )
    document.cell(note_row, 3).alignment = copy(document.cell(note_row - 1, 3).alignment)

    book.save(TARGET)
    saved = openpyxl.load_workbook(TARGET)
    after_links = hyperlink_count(saved)
    q3_link = saved["Q3-2026_Tickets"]["A1"].hyperlink
    summary_link = saved["Q3-2026_Ticket_Summary"]["A1"].hyperlink
    print("tickets", len(tickets), "q3", len(q3))
    print("q3 stats", q3_stats)
    print("q2", q2)
    print("q4", q4)
    print("all", all_totals)
    print("appraisal", appraisal_totals)
    print("links", before_links, "->", after_links)
    print("q3 link", None if q3_link is None else q3_link.location)
    print("summary link", None if summary_link is None else summary_link.location)
    print("data issue", data_issue)
    if after_links < before_links or q3_link is None or q3_link.location != CHECKLIST:
        raise SystemExit("Checklist link was not preserved on the new Q3 sheets")


if __name__ == "__main__":
    main()
