import { previewTicketCsv } from "@/infrastructure/csv/tickets";

const header = "Ticket No.,Description,Status,Assign Date,Closure Date,Code Lines Changed,SQL Lines Changed,Quarter";

describe("ticket csv preview", () => {
  it("keeps a blank line count blank and accepts an explicit zero", () => {
    const preview = previewTicketCsv(`${header}\n21546,Open item,InProgress,2026-02-11,, ,32,Q1-2026\n18851,Closed item,Closed,2026-02-11,2026-03-18,0,0,Q1-2026`, "rep_utkarsh", []);
    expect(preview.issues).toEqual([]);
    expect(preview.ready[0]?.codeLines).toBeNull();
    expect(preview.ready[0]?.sqlLines).toBe(32);
    expect(preview.ready[1]?.codeLines).toBe(0);
    expect(preview.ready[1]?.cycleDays).toBe(35);
  });

  it("reports the row, column, and a correction for a bad date without accepting the batch", () => {
    const preview = previewTicketCsv(`${header}\n100,Bad date,Closed,46000,2026-03-18,1,1,Q1-2026`, "rep_utkarsh", []);
    expect(preview.ready).toEqual([]);
    expect(preview.issues[0]).toMatchObject({ row: 2, column: "assign date", value: "46000" });
    expect(preview.issues[0]?.suggestion).toContain("YYYY-MM-DD");
  });

  it("flags a repeated ticket in the same quarter", () => {
    const preview = previewTicketCsv(`${header}\n32233,First,InProgress,2026-01-01,,,,Q1-2026`, "rep_krishna", [
      { id: "existing", reporteeId: "rep_krishna", ticketNo: "32233", quarterId: "q1-2026", codeLines: null, sqlLines: null, cycleDays: null, updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(preview.ready).toEqual([]);
    expect(preview.issues[0]?.message).toContain("32233");
  });
});
