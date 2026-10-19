import { daysBetween, floorRatio, isClosedStatus, isWaitState, isYesFlag, round1 } from "./status";
import type { AchievementStatus, AssessmentRuleSet, KpiAssessment, OkrChecklistEntry, Ticket } from "./types";

export interface MetricComputation {
  formula: string;
  actual: number | null;
  target: number | null;
  status: AchievementStatus;
  sourceIds: string[];
  missing: string[];
  warnings: string[];
  detail?: string;
}

export interface TicketQuarterStats {
  quarterId: string;
  total: number;
  closed: number;
  open: number;
  codeChange: number;
  spChange: number;
  codeLines: number | null;
  sqlLines: number | null;
  openTicketNos: string[];
  cycleDays: number[];
  tickets: Ticket[];
}

export function ticketsForQuarter(tickets: Ticket[], reporteeId: string, quarterId: string): Ticket[] {
  return tickets.filter((ticket) => ticket.reporteeId === reporteeId && ticket.quarterId === quarterId);
}

export function summarizeTickets(tickets: Ticket[], rules: AssessmentRuleSet, quarterId: string): TicketQuarterStats {
  const closed = tickets.filter((ticket) => isClosedStatus(ticket.status, rules.closedStatuses));
  const open = tickets.filter((ticket) => !isClosedStatus(ticket.status, rules.closedStatuses));
  const codeLines = sumNullable(tickets.map((ticket) => ticket.codeLines));
  const sqlLines = sumNullable(tickets.map((ticket) => ticket.sqlLines));
  const cycleDays = closed
    .map((ticket) => ticket.cycleDays ?? daysBetween(ticket.assignDate ?? "", ticket.closureDate ?? ""))
    .filter((value): value is number => value != null);
  return {
    quarterId,
    total: tickets.length,
    closed: closed.length,
    open: open.length,
    codeChange: tickets.filter((ticket) => isYesFlag(ticket.codeChange)).length,
    spChange: tickets.filter((ticket) => isYesFlag(ticket.spChange)).length,
    codeLines,
    sqlLines,
    openTicketNos: open.map((ticket) => ticket.ticketNo),
    cycleDays,
    tickets,
  };
}

function sumNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0);
}

export function velocity(stats: TicketQuarterStats, rules: AssessmentRuleSet, target: number | null): MetricComputation {
  const missing: string[] = [];
  if (target == null) missing.push("quarterly ticket target");
  if (stats.total === 0 && !rules.velocity.trainingQuarterIds.includes(stats.quarterId)) {
    return {
      formula: "Achieved when closed >= target OR closed >= floor(target × threshold). No tickets means not assessed, not a zero failure.",
      actual: null,
      target,
      status: "insufficient_evidence",
      sourceIds: [],
      missing: ["tickets for quarter"],
      warnings: ["No tickets are recorded for this quarter. This is not treated as zero performance."],
    };
  }
  const alternate = target == null ? null : floorRatio(target, rules.velocity.thresholdRatio);
  const met = target != null && (stats.closed >= target || (alternate != null && stats.closed >= alternate));
  const training = rules.velocity.trainingQuarterIds.includes(stats.quarterId);
  return {
    formula: `Yes if closed >= target OR closed >= floor(target × ${rules.velocity.thresholdRatio}).`,
    actual: stats.closed,
    target,
    status: training ? "overridden" : target == null ? "pending" : met ? "achieved" : "not_achieved",
    sourceIds: stats.tickets.map((ticket) => ticket.id),
    missing,
    warnings: training ? ["Training / KT quarter. Recorded achievement is a manager override and is not inferred from the ticket count."] : [],
    detail: alternate != null ? `70% floor threshold is ${alternate}.` : undefined,
  };
}

export function spillover(stats: TicketQuarterStats, rules: AssessmentRuleSet): MetricComputation {
  if (stats.total === 0) {
    return {
      formula: `Achieved if open <= ${rules.spill.maxOpen} OR spill% <= ${rules.spill.maxSpillPercent}.`,
      actual: null,
      target: rules.spill.maxSpillPercent,
      status: "not_applicable",
      sourceIds: [],
      missing: [],
      warnings: ["No tickets in quarter. Spillover is not applicable and is not shown as 0% or as a failure."],
    };
  }
  const percent = round1((stats.open / stats.total) * 100);
  const byCount = stats.open <= rules.spill.maxOpen;
  const byPercent = percent <= rules.spill.maxSpillPercent;
  const met = rules.spill.combiner === "or" ? byCount || byPercent : byCount && byPercent;
  return {
    formula: `Achieved if open <= ${rules.spill.maxOpen} ${rules.spill.combiner.toUpperCase()} spill% <= ${rules.spill.maxSpillPercent}. Spill% = open / total × 100.`,
    actual: percent,
    target: rules.spill.maxSpillPercent,
    status: met ? "achieved" : "not_achieved",
    sourceIds: stats.tickets.map((ticket) => ticket.id),
    missing: [],
    warnings: ["Proxy metric. The Helpdesk export has no Jira sprint spill field. Open statuses are the spill proxy."],
    detail: `Open ${stats.open} of ${stats.total}.`,
  };
}

export function sla(stats: TicketQuarterStats, rules: AssessmentRuleSet): MetricComputation {
  if (stats.cycleDays.length === 0) {
    return {
      formula: `Proxy = average Assign Date → Closure Date. Achieved when average <= ${rules.sla.maxAverageCycleDays} days.`,
      actual: null,
      target: rules.sla.maxAverageCycleDays,
      status: "insufficient_evidence",
      sourceIds: stats.tickets.map((ticket) => ticket.id),
      missing: ["assign date and closure date on closed tickets"],
      warnings: ["No release SLA export. This is a cycle-day proxy, not a verified SLA feed."],
    };
  }
  const average = round1(stats.cycleDays.reduce((sum, value) => sum + value, 0) / stats.cycleDays.length);
  const max = Math.max(...stats.cycleDays);
  return {
    formula: `Average cycle days <= ${rules.sla.maxAverageCycleDays}.`,
    actual: average,
    target: rules.sla.maxAverageCycleDays,
    status: average <= rules.sla.maxAverageCycleDays ? "achieved" : "not_achieved",
    sourceIds: stats.tickets.map((ticket) => ticket.id),
    missing: [],
    warnings: ["Proxy metric. Workbook rows sometimes keep a recorded Yes even when the average exceeds 45 days. The recorded assessment is preserved separately."],
    detail: `Max cycle days ${max}.`,
  };
}

export function rework(stats: TicketQuarterStats, rules: AssessmentRuleSet): MetricComputation {
  if (stats.total === 0) {
    return {
      formula: "Rework proxy count / tickets. Wait states follow the reportee rule.",
      actual: null,
      target: rules.rework.maxRatePercent,
      status: "not_applicable",
      sourceIds: [],
      missing: [],
      warnings: ["No tickets. Rework is not applicable."],
    };
  }
  const flagged = stats.tickets.filter((ticket) => isRework(ticket, rules));
  const rate = round1((flagged.length / stats.total) * 100);
  return {
    formula: rules.rework.countWaitStates
      ? "Proxy = wait-state status (OnHold / In-UAT / Approver) OR rework keywords. Not a Jira reopen feed."
      : "Proxy = rework/reopen keywords only. OnHold / In-UAT / Approver are wait states and are not counted. Not a Jira reopen feed.",
    actual: rate,
    target: rules.rework.maxRatePercent,
    status: rate <= rules.rework.maxRatePercent ? "achieved" : "not_achieved",
    sourceIds: flagged.map((ticket) => ticket.id),
    missing: [],
    warnings: ["Proxy metric. The Helpdesk export has no dedicated reopen field."],
    detail: `${flagged.length} of ${stats.total}.`,
  };
}

function isRework(ticket: Ticket, rules: AssessmentRuleSet): boolean {
  const haystack = `${ticket.description ?? ""} ${ticket.status ?? ""}`.toLowerCase();
  if (rules.rework.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) return true;
  return rules.rework.countWaitStates && isWaitState(ticket.status);
}

export function defectThemes(stats: TicketQuarterStats, rules: AssessmentRuleSet): MetricComputation {
  const curated = stats.tickets.filter((ticket) => ticket.defectLike === true);
  const unknown = stats.tickets.filter((ticket) => ticket.defectLike == null && isClosedStatus(ticket.status, rules.closedStatuses));
  if (stats.closed === 0 && stats.total === 0) {
    return {
      formula: `Curated defect-like flags. Achieved when count <= ${rules.defect.maxThemes}.`,
      actual: null,
      target: rules.defect.maxThemes,
      status: "not_applicable",
      sourceIds: [],
      missing: [],
      warnings: [],
    };
  }
  return {
    formula: `Client-reported / defect-theme proxy. Achieved when curated defect-like count <= ${rules.defect.maxThemes}. Keyword matches are suggestions and do not replace a curated flag.`,
    actual: curated.length,
    target: rules.defect.maxThemes,
    status: curated.length <= rules.defect.maxThemes ? "achieved" : "not_achieved",
    sourceIds: curated.map((ticket) => ticket.id),
    missing: unknown.length ? ["defect-like flag on some closed tickets"] : [],
    warnings: [
      "Defect-like flags in the source workbooks are curated. They do not consistently match a simple keyword list, and a comment may still say client-reported defects = 0 while the theme proxy is above zero.",
    ],
    detail: unknown.length ? `${unknown.length} closed tickets have no defect flag.` : undefined,
  };
}

export function kpiPoints(status: AchievementStatus, weight: number | null): number | null {
  if (weight == null) return null;
  if (status === "achieved" || status === "overridden") return weight;
  if (status === "not_achieved") return 0;
  return null;
}

export function effectiveStatus(assessment: Pick<KpiAssessment, "status" | "manualOverride" | "calculatedStatus">): AchievementStatus {
  if (assessment.manualOverride) return "overridden";
  return assessment.status;
}

export interface ScoreRollup {
  achievedWeight: number | null;
  possibleWeight: number | null;
  achievedCount: number;
  notAchievedCount: number;
  pendingCount: number;
  notApplicableCount: number;
  insufficientCount: number;
  overriddenCount: number;
  missingWeight: number;
}

export function rollupAssessments(rows: KpiAssessment[]): ScoreRollup {
  let achievedWeight = 0;
  let possibleWeight = 0;
  let scored = false;
  for (const row of rows) {
    if (row.weightUsed != null) possibleWeight += row.weightUsed;
    const points = kpiPoints(row.status, row.weightUsed);
    if (points != null) {
      achievedWeight += points;
      scored = true;
    }
  }
  return {
    achievedWeight: scored ? achievedWeight : null,
    possibleWeight: rows.some((row) => row.weightUsed != null) ? possibleWeight : null,
    achievedCount: rows.filter((row) => row.status === "achieved").length,
    notAchievedCount: rows.filter((row) => row.status === "not_achieved").length,
    pendingCount: rows.filter((row) => row.status === "pending").length,
    notApplicableCount: rows.filter((row) => row.status === "not_applicable").length,
    insufficientCount: rows.filter((row) => row.status === "insufficient_evidence").length,
    overriddenCount: rows.filter((row) => row.manualOverride || row.status === "overridden").length,
    missingWeight: rows.filter((row) => row.weightUsed == null).length,
  };
}

export function checklistScore(entries: OkrChecklistEntry[]): { achieved: number | null; possible: number | null; pending: number } {
  if (entries.length === 0) return { achieved: null, possible: null, pending: 0 };
  const withWeight = entries.filter((entry) => entry.weightage != null);
  const pending = entries.filter((entry) => entry.okrMet === "pending" || entry.okrMet === "insufficient_evidence").length;
  if (withWeight.length === 0) return { achieved: null, possible: null, pending };
  const possible = withWeight.reduce((sum, entry) => sum + (entry.weightage ?? 0), 0);
  const decided = withWeight.filter((entry) => entry.okrMet === "achieved" || entry.okrMet === "not_achieved" || entry.okrMet === "overridden");
  if (decided.length === 0) return { achieved: null, possible, pending };
  const achieved = decided.reduce((sum, entry) => sum + (kpiPoints(entry.okrMet, entry.weightage) ?? 0), 0);
  return { achieved, possible, pending };
}

export function applyOverride(
  calculated: AchievementStatus,
  override: { status: AchievementStatus; reason: string } | null,
): { status: AchievementStatus; calculatedStatus: AchievementStatus; manualOverride: boolean; overrideReason?: string } {
  if (!override) {
    return { status: calculated, calculatedStatus: calculated, manualOverride: false };
  }
  return {
    status: override.status,
    calculatedStatus: calculated,
    manualOverride: true,
    overrideReason: override.reason,
  };
}
