import { describe, expect, it } from "vitest";
import { linkLabel, okrTitle, parseWorkbookLink, sheetLabel } from "./sheet-links";

describe("link labels", () => {
  it("names a checklist row by its OKR, not the sheet and cell", () => {
    expect(linkLabel(parseWorkbookLink("Utkarsh_OKR_Checklist!A2"), "Timely Delivery")).toBe("OKR · Timely Delivery");
  });

  it("says a header link has no OKR line", () => {
    expect(linkLabel(parseWorkbookLink("Utkarsh_OKR_Checklist!A1"))).toBe("No OKR line yet");
  });

  it("names quarter and metric sheets in plain words", () => {
    expect(sheetLabel("Q3-2025_Ticket_Summary")).toBe("Q3-2025 ticket summary");
    expect(sheetLabel("Q4-2025_Tickets")).toBe("Q4-2025 tickets");
    expect(sheetLabel("Helpdesk_Discipline")).toBe("Helpdesk discipline");
    expect(sheetLabel("KPI_2026")).toBe("2026 KPIs");
    expect(linkLabel(parseWorkbookLink("Rework_Reopen_Proxy!A1"))).toBe("Rework and reopen");
  });

  it("names external addresses by service", () => {
    expect(linkLabel(parseWorkbookLink("https://helpdesk.gvwgroup.com/Timesheet.do"))).toBe("Helpdesk timesheet");
    expect(linkLabel(parseWorkbookLink("https://bitbucket.org/msnalashaa/performance-learning-development/src/main/2026/Santosh/"))).toBe("Bitbucket · performance learning development · 2026 / Santosh");
  });

  it("shortens an OKR to the phrase before the colon", () => {
    expect(okrTitle("Timely Delivery: Complete assigned tasks on or before deadlines.")).toBe("Timely Delivery");
  });
});

describe("parseWorkbookLink", () => {
  it("follows a KPI OKR Link to the checklist row", () => {
    expect(parseWorkbookLink("Utkarsh_OKR_Checklist!A2")).toMatchObject({
      kind: "sheet",
      sheet: "Utkarsh_OKR_Checklist",
      cell: "A2",
      row: 2,
      section: "checklist",
    });
  });

  it("follows an OKR artifact to the quarter ticket sheet", () => {
    expect(parseWorkbookLink("Q3-2025_Ticket_Summary!A1")).toMatchObject({
      kind: "sheet",
      section: "tickets",
      quarterId: "q3-2025",
    });
  });

  it("follows a metric sheet named without a cell", () => {
    expect(parseWorkbookLink("Helpdesk_Discipline")).toMatchObject({ kind: "sheet", section: "quality", sheet: "Helpdesk_Discipline" });
  });

  it("keeps an external address", () => {
    expect(parseWorkbookLink("https://helpdesk.gvwgroup.com/Timesheet.do")).toMatchObject({
      kind: "url",
      url: "https://helpdesk.gvwgroup.com/Timesheet.do",
    });
  });

  it("keeps a file path that is not a sheet in the workbook", () => {
    expect(parseWorkbookLink("PMS/Krishna/Krishnaraj_POC_25-26.xlsx").kind).toBe("file");
  });
});
