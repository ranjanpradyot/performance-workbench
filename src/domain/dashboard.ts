import { checklistScore, kpiPoints, rollupAssessments, summarizeTickets, ticketsForQuarter } from "@/domain/calculations";
import type { AchievementStatus, KpiAssessment, Reportee, WorkbenchDataset } from "@/domain/types";
import type { Filters } from "@/domain/filters";

export interface AttentionItem {
  reporteeId: string;
  name: string;
  reason: string;
  tone: "warning" | "error";
}

export interface DashboardModel {
  activeReportees: number;
  reporteesWithQuarterData: number | null;
  kpiAchieved: number;
  kpiNotAchieved: number;
  kpiPending: number;
  kpiNotApplicable: number;
  kpiPoints: number | null;
  kpiPossible: number | null;
  okrAchieved: number | null;
  okrPossible: number | null;
  learningAchieved: number;
  learningPending: number;
  learningTotal: number;
  closedTickets: number | null;
  openTickets: number | null;
  totalTickets: number | null;
  comparisons: Array<{ id: string; name: string; color: string; points: number | null; possible: number | null; closed: number | null }>;
  attention: AttentionItem[];
  trend: Array<{ label: string; closed: number | null; target: number | null }>;
}

function reporteesInScope(dataset: WorkbenchDataset, filters: Filters): Reportee[] {
  return dataset.reportees.filter((reportee) => {
    if (filters.reporteeId !== "all" && reportee.id !== filters.reporteeId) return false;
    if (filters.directory === "active") return reportee.status === "active";
    if (filters.directory === "archived") return reportee.status === "archived";
    return true;
  });
}

function assessmentVisible(row: KpiAssessment, filters: Filters, dataset: WorkbenchDataset): boolean {
  if (filters.quarterId !== "all" && row.quarterId !== filters.quarterId) return false;
  if (filters.year !== "all") {
    const quarter = dataset.quarters.find((item) => item.id === row.quarterId);
    if (quarter && String(quarter.year) !== filters.year) return false;
  }
  if (filters.status !== "all" && row.status !== filters.status) return false;
  if (filters.category !== "all") {
    const definition = dataset.kpiDefinitions.find((item) => item.id === row.kpiDefinitionId);
    if (definition?.category !== filters.category) return false;
  }
  return true;
}

export function buildDashboard(dataset: WorkbenchDataset, filters: Filters): DashboardModel {
  const people = reporteesInScope(dataset, filters);
  const ids = new Set(people.map((person) => person.id));
  const assessments = dataset.kpiAssessments.filter((row) => ids.has(row.reporteeId) && assessmentVisible(row, filters, dataset));
  const rollup = rollupAssessments(assessments);
  const checklist = dataset.okrChecklistEntries.filter((row) => ids.has(row.reporteeId) && (filters.quarterId === "all" || row.quarterId === filters.quarterId) && (filters.category === "all" || row.kpiAffected === filters.category));
  const okr = checklistScore(checklist);
  const learning = dataset.learningEvidence.filter((row) => ids.has(row.reporteeId) && (filters.quarterId === "all" || row.quarterId === filters.quarterId));
  const quarters = dataset.quarters.filter((quarter) => (filters.quarterId === "all" || quarter.id === filters.quarterId) && (filters.year === "all" || String(quarter.year) === filters.year));
  let totalTickets: number | null = 0;
  let closedTickets: number | null = 0;
  let openTickets: number | null = 0;
  let anyTickets = false;
  for (const person of people) {
    for (const quarter of quarters) {
      const rules = dataset.assessmentRules.find((item) => item.reporteeId === person.id);
      if (!rules) continue;
      const tickets = ticketsForQuarter(dataset.tickets, person.id, quarter.id);
      if (tickets.length === 0) continue;
      anyTickets = true;
      const stats = summarizeTickets(tickets, rules, quarter.id);
      totalTickets = (totalTickets ?? 0) + stats.total;
      closedTickets = (closedTickets ?? 0) + stats.closed;
      openTickets = (openTickets ?? 0) + stats.open;
    }
  }
  if (!anyTickets) {
    totalTickets = null;
    closedTickets = null;
    openTickets = null;
  }
  const withData = filters.quarterId === "all"
    ? null
    : people.filter((person) => assessments.some((row) => row.reporteeId === person.id) || checklist.some((row) => row.reporteeId === person.id) || dataset.tickets.some((ticket) => ticket.reporteeId === person.id && ticket.quarterId === filters.quarterId)).length;

  const attention: AttentionItem[] = [];
  for (const person of people) {
    const mine = assessments.filter((row) => row.reporteeId === person.id);
    if (mine.some((row) => row.status === "not_achieved")) attention.push({ reporteeId: person.id, name: person.fullName, reason: "One or more KPIs are not achieved.", tone: "error" });
    if (mine.some((row) => row.status === "pending" || row.status === "insufficient_evidence")) attention.push({ reporteeId: person.id, name: person.fullName, reason: "Assessment or evidence is still incomplete.", tone: "warning" });
    const learningGap = learning.filter((row) => row.reporteeId === person.id && row.status === "pending");
    if (learningGap.length) attention.push({ reporteeId: person.id, name: person.fullName, reason: "Learning evidence is not assessed.", tone: "warning" });
  }

  const trend = dataset.quarters
    .filter((quarter) => filters.year === "all" || String(quarter.year) === filters.year)
    .map((quarter) => {
      let closed: number | null = null;
      let target: number | null = null;
      for (const person of people) {
        const rules = dataset.assessmentRules.find((item) => item.reporteeId === person.id);
        if (!rules) continue;
        const tickets = ticketsForQuarter(dataset.tickets, person.id, quarter.id);
        if (!tickets.length) continue;
        const stats = summarizeTickets(tickets, rules, quarter.id);
        closed = (closed ?? 0) + stats.closed;
        const quarterTarget = rules.velocityTargets[quarter.id];
        if (quarterTarget != null) target = (target ?? 0) + quarterTarget;
      }
      return { label: quarter.label, closed, target };
    });

  return {
    activeReportees: dataset.reportees.filter((person) => person.status === "active" && (filters.reporteeId === "all" || person.id === filters.reporteeId)).length,
    reporteesWithQuarterData: withData,
    kpiAchieved: rollup.achievedCount,
    kpiNotAchieved: rollup.notAchievedCount,
    kpiPending: rollup.pendingCount,
    kpiNotApplicable: rollup.notApplicableCount,
    kpiPoints: rollup.achievedWeight,
    kpiPossible: rollup.possibleWeight,
    okrAchieved: okr.achieved,
    okrPossible: okr.possible,
    learningAchieved: learning.filter((row) => row.status === "achieved").length,
    learningPending: learning.filter((row) => row.status === "pending").length,
    learningTotal: learning.length,
    closedTickets,
    openTickets,
    totalTickets,
    comparisons: people.map((person) => {
      const mine = assessments.filter((row) => row.reporteeId === person.id);
      const score = rollupAssessments(mine);
      const rules = dataset.assessmentRules.find((item) => item.reporteeId === person.id);
      let closed: number | null = null;
      if (rules) {
        for (const quarter of quarters) {
          const tickets = ticketsForQuarter(dataset.tickets, person.id, quarter.id);
          if (!tickets.length) continue;
          closed = (closed ?? 0) + summarizeTickets(tickets, rules, quarter.id).closed;
        }
      }
      return { id: person.id, name: person.fullName, color: person.themeColor, points: score.achievedWeight, possible: score.possibleWeight, closed };
    }),
    attention,
    trend,
  };
}

export interface QuarterScore {
  quarterId: string;
  label: string;
  achieved: number | null;
  possible: number | null;
  /** Worst decided outcome. Unassessed KPIs stay out of this icon and out of the fraction. */
  status: AchievementStatus;
  unassessed: number;
  kpis: Array<{ id: string; name: string; status: AchievementStatus; points: number | null; weight: number | null; actual?: string; overridden: boolean; linked: boolean }>;
}

export function quarterStatus(statuses: AchievementStatus[]): AchievementStatus {
  if (statuses.some((status) => status === "not_achieved")) return "not_achieved";
  const decided = statuses.some((status) => status === "achieved" || status === "overridden");
  if (!decided && statuses.some((status) => status === "pending" || status === "insufficient_evidence")) return "pending";
  if (statuses.length > 0 && statuses.every((status) => status === "not_applicable")) return "not_applicable";
  return "achieved";
}

/** One entry per quarter that has KPI assessments for the reportee, in quarter order. */
export function quarterScores(dataset: WorkbenchDataset, reporteeId: string, quarterIds?: string[]): QuarterScore[] {
  const rows = dataset.kpiAssessments.filter((row) => row.reporteeId === reporteeId);
  return [...dataset.quarters]
    .sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber)
    .filter((quarter) => (!quarterIds || quarterIds.includes(quarter.id)) && rows.some((row) => row.quarterId === quarter.id))
    .map((quarter) => {
      const mine = rows.filter((row) => row.quarterId === quarter.id);
      const definitionOf = (row: KpiAssessment) => dataset.kpiDefinitions.find((item) => item.id === row.kpiDefinitionId);
      const kpis = [...mine]
        .sort((a, b) => (definitionOf(a)?.displayOrder ?? 0) - (definitionOf(b)?.displayOrder ?? 0))
        .map((row) => ({ id: row.id, name: definitionOf(row)?.sourceLabel ?? row.kpiDefinitionId, status: row.status, points: kpiPoints(row.status, row.weightUsed), weight: row.weightUsed, actual: row.actual, overridden: row.manualOverride, linked: row.evidenceRefs.length > 0 }));
      const decided = kpis.filter((kpi) => kpi.points != null && kpi.weight != null);
      const unassessed = kpis.filter((kpi) => kpi.points == null && kpi.weight != null && kpi.status !== "not_applicable").reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0);
      const achieved = decided.length ? decided.reduce((sum, kpi) => sum + (kpi.points ?? 0), 0) : null;
      const possible = decided.length ? decided.reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0) : kpis.some((kpi) => kpi.weight != null) ? kpis.reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0) : null;
      return { quarterId: quarter.id, label: quarter.label, achieved, possible, unassessed, status: quarterStatus(mine.map((row) => row.status)), kpis };
    });
}

export function formatMetric(value: number | null, digits = 1): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function pointsLabel(points: number | null): string {
  return points == null ? "Not assessed" : String(points);
}

export { kpiPoints };
export type { AchievementStatus };
