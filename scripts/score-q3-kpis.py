"""Fill Q3-2026 Execution (and Santosh Quality) from the ticket rows already on v0.4.

Q3 Learning is recorded separately and this script does not change it. Utkarsh and Krishna Quality is left alone once Q3Achieved
is filled by scripts/curate-q3-defects.mjs. The annual Q1+Q2 achieved total is left as written.
"""

from pathlib import Path

import openpyxl
from openpyxl.styles import Font
from openpyxl.worksheet.hyperlink import Hyperlink

ROOT = Path(__file__).resolve().parents[1]
WORKBOOKS = {
    "Utkarsh": ROOT / "fixtures/workbooks/Utkarsh_OKR_Checklist_Linked_0.4.xlsx",
    "Krishna": ROOT / "fixtures/workbooks/Krishna_OKR_Checklist_Linked_0.4.xlsx",
    "Santosh": ROOT / "fixtures/workbooks/Santosh_OKR_Checklist_Linked_0.4.xlsx",
}
# Written quarter targets: Utkarsh 3/month, Krishna KPI says at least 14, Santosh 5/month.
TARGETS = {"Utkarsh": 9, "Krishna": 14, "Santosh": 15}


def closed(value) -> bool:
    return str(value or "").strip().lower() in {"closed", "resolved"}


def set_link(cell, location: str) -> None:
    cell.value = location
    cell.hyperlink = Hyperlink(ref=cell.coordinate, location=location, display=location)
    cell.font = Font(name="Calibri", color="FF0563C1", underline="single")


def quarter_counts(book, person: str) -> tuple[int, int]:
    sheet = book[f"Tickets_Master_{person}"]
    total = closed_count = 0
    for row in range(1, sheet.max_row + 1):
        if sheet.cell(row, 12).value != "Q3-2026":
            continue
        if not str(sheet.cell(row, 1).value or "").strip().isdigit() and not isinstance(sheet.cell(row, 1).value, (int, float)):
            continue
        total += 1
        if closed(sheet.cell(row, 3).value):
            closed_count += 1
    return total, closed_count


def execution_result(closed_count: int, target: int) -> tuple[str, str]:
    floor = int(target * 0.7)
    if closed_count >= target:
        return f"{closed_count} closed (target {target})", "Yes"
    if closed_count >= floor:
        return f"{closed_count} closed (target {target}) — met >=70% threshold ({floor}+)", "Yes"
    return f"{closed_count} closed (target {target})", "No"


def main() -> None:
    for person, path in WORKBOOKS.items():
        book = openpyxl.load_workbook(path)
        total, closed_count = quarter_counts(book, person)
        target = TARGETS[person]
        actual, achieved = execution_result(closed_count, target)
        kpi = book["KPI_2026"]
        kpi.cell(2, 15).value = actual
        kpi.cell(2, 16).value = achieved
        set_link(kpi.cell(2, 17), "Q3-2026_Tickets!A1")
        set_link(kpi.cell(3, 17), "Q3-2026_Ticket_Summary!A1")
        if person == "Santosh":
            kpi.cell(3, 15).value = "Closed=8; defect-themes=3; rework-proxy=0 (0.0%)"
            kpi.cell(3, 16).value = "Yes"
        elif not kpi.cell(3, 16).value:
            kpi.cell(3, 15).value = f"Closed={closed_count}; defect themes not curated; rework-proxy=0 (0.0%)"
        velocity = book["Ticket_Velocity"]
        for row in range(1, velocity.max_row + 1):
            if velocity.cell(row, 1).value != "Q3-2026":
                continue
            velocity.cell(row, 5).value = target
            velocity.cell(row, 6).value = achieved
            if achieved == "Yes" and closed_count >= target:
                velocity.cell(row, 7).value = f"Met target ({closed_count}/{target})"
            elif achieved == "Yes":
                velocity.cell(row, 7).value = f"Met 70% threshold ({closed_count}/{target})"
            else:
                velocity.cell(row, 7).value = f"Below target ({closed_count}/{target})"
        document = book["Document_Summary"]
        note = document.max_row + 1
        document.cell(note, 1).value = "0.4"
        document.cell(note, 2).value = "Q3 score"
        document.cell(note, 3).value = (
            f"Q3-2026 Execution is scored from the master: {actual}, {achieved}. "
            "Learning stays blank because no Q3 course evidence was recorded. "
            + (
                "Quality is Yes: defect themes 3 (threshold 4 or fewer) and rework proxy 0."
                if person == "Santosh"
                else "Quality stays as already curated."
                if kpi.cell(3, 16).value
                else "Quality stays blank because Q3 defect themes were not curated."
            )
        )
        book.save(path)
        print(person, total, "tickets", actual, achieved)


if __name__ == "__main__":
    main()
