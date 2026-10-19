import { floorRatio, isClosedStatus, normalizeStatus, quarterIdFromDate } from "@/domain/status";
import { applyOverride, kpiPoints, spillover, summarizeTickets, velocity } from "@/domain/calculations";
import type { AssessmentRuleSet, Ticket } from "@/domain/types";

const rules: AssessmentRuleSet = {
  id: "rule",
  reporteeId: "rep",
  version: 1,
  scoreModel: "scoped_quarter_weight",
  inScopeQuarterIds: ["q3-2025"],
  closedStatuses: ["Closed", "Resolved", "RESOLVED"],
  quarterAssignment: "workbook_quarter_authoritative",
  quarterAssignmentNote: "test",
  velocity: { thresholdRatio: 0.7, useFloor: true, trainingQuarterIds: ["q3-2025"] },
  velocityTargets: { "q1-2026": 9, "q2-2026": 12 },
  spill: { maxOpen: 2, maxSpillPercent: 20, combiner: "or" },
  sla: { maxAverageCycleDays: 45 },
  defect: { maxThemes: 4, keywordSuggestion: [] },
  rework: { maxRatePercent: 5, countWaitStates: false, keywords: ["reopen"] },
  prRejectionMaxPercent: 10,
  processMinPercent: 90,
  notes: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function ticket(partial: Partial<Ticket> & Pick<Ticket, "id" | "ticketNo" | "status">): Ticket {
  return {
    reporteeId: "rep",
    codeLines: null,
    sqlLines: null,
    cycleDays: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("assessment calculations", () => {
  it("classifies closed statuses without treating blanks as closed", () => {
    expect(isClosedStatus("RESOLVED", rules.closedStatuses)).toBe(true);
    expect(isClosedStatus("InProgress - Approver", rules.closedStatuses)).toBe(false);
    expect(isClosedStatus(undefined, rules.closedStatuses)).toBe(false);
  });

  it("uses the 70 percent floor that the workbooks document", () => {
    expect(floorRatio(9, 0.7)).toBe(6);
    expect(floorRatio(12, 0.7)).toBe(8);
    expect(floorRatio(8, 0.7)).toBe(5);
    expect(floorRatio(3, 0.7)).toBe(2);
  });

  it("marks Utkarsh Q1 velocity achieved on the 70 percent threshold and Santosh Q2 as not achieved", () => {
    const utkarsh = summarizeTickets(Array.from({ length: 7 }, (_, index) => ticket({ id: `a${index}`, ticketNo: String(index), status: "Closed", quarterId: "q1-2026" })), rules, "q1-2026");
    expect(velocity(utkarsh, { ...rules, velocity: { ...rules.velocity, trainingQuarterIds: [] } }, 9).status).toBe("achieved");
    const santosh = summarizeTickets(Array.from({ length: 6 }, (_, index) => ticket({ id: `b${index}`, ticketNo: String(index), status: "Closed", quarterId: "q2-2026" })), rules, "q2-2026");
    expect(velocity(santosh, { ...rules, velocity: { ...rules.velocity, trainingQuarterIds: [] } }, 12).status).toBe("not_achieved");
  });

  it("does not turn an empty quarter into zero performance", () => {
    const empty = summarizeTickets([], rules, "q3-2026");
    const result = velocity(empty, { ...rules, velocity: { ...rules.velocity, trainingQuarterIds: [] } }, 9);
    expect(result.status).toBe("insufficient_evidence");
    expect(result.actual).toBeNull();
  });

  it("keeps a training override distinct from the calculated miss", () => {
    const empty = summarizeTickets([], rules, "q3-2025");
    const result = velocity(empty, rules, 8);
    expect(result.status).toBe("overridden");
    const applied = applyOverride("not_achieved", { status: "achieved", reason: "PM Yes during KT" });
    expect(applied.manualOverride).toBe(true);
    expect(applied.calculatedStatus).toBe("not_achieved");
    expect(applied.status).toBe("achieved");
  });

  it("scores Yes as the quarter weight and leaves pending unscored", () => {
    expect(kpiPoints("achieved", 14.5)).toBe(14.5);
    expect(kpiPoints("not_achieved", 14.5)).toBe(0);
    expect(kpiPoints("pending", 14.5)).toBeNull();
    expect(kpiPoints("not_applicable", 14.5)).toBeNull();
  });

  it("treats spill as achieved when open tickets are within the count even if the percent is high", () => {
    const stats = summarizeTickets([
      ticket({ id: "1", ticketNo: "1", status: "InProgress" }),
      ticket({ id: "2", ticketNo: "2", status: "Closed" }),
    ], rules, "q1-2025");
    const result = spillover(stats, rules);
    expect(result.actual).toBe(50);
    expect(result.status).toBe("achieved");
  });

  it("assigns a quarter from a closure date without shifting the calendar quarter", () => {
    expect(quarterIdFromDate("2026-03-18")).toBe("q1-2026");
    expect(normalizeStatus("N/A")).toBe("not_applicable");
    expect(normalizeStatus("")).toBe("pending");
  });
});
