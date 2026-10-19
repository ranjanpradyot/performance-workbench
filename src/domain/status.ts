import type { AchievementStatus } from "./types";

const YES = new Set(["yes", "y", "achieved", "pass", "met", "true"]);
const NO = new Set(["no", "n", "not achieved", "not_achieved", "fail", "failed", "false"]);
const NA = new Set(["n/a", "na", "—", "-", "–", "not applicable", "not_applicable"]);

export function normalizeStatus(raw: string | null | undefined): AchievementStatus {
  if (raw == null) return "pending";
  const text = raw.trim().toLowerCase();
  if (!text) return "pending";
  if (YES.has(text)) return "achieved";
  if (NO.has(text)) return "not_achieved";
  if (NA.has(text)) return "not_applicable";
  if (text.includes("pending") || text.includes("insufficient")) return "pending";
  return "pending";
}

export function statusLabel(status: AchievementStatus | "missing" | "zero"): string {
  switch (status) {
    case "achieved":
      return "Achieved";
    case "not_achieved":
      return "Not achieved";
    case "pending":
      return "Not assessed";
    case "not_applicable":
      return "Not applicable";
    case "insufficient_evidence":
      return "Insufficient evidence";
    case "overridden":
      return "Manually overridden";
    case "missing":
      return "Missing";
    case "zero":
      return "Zero";
    default:
      return status;
  }
}

export function isClosedStatus(status: string | undefined, closedStatuses: string[]): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return closedStatuses.some((item) => item.trim().toLowerCase() === normalized);
}

export function isYesFlag(value: string | undefined): boolean {
  if (!value) return false;
  return YES.has(value.trim().toLowerCase());
}

export function isWaitState(status: string | undefined): boolean {
  if (!status) return false;
  const text = status.toLowerCase();
  return text.includes("onhold") || text.includes("on hold") || text.includes("in-uat") || text.includes("in uat") || text.includes("approver");
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function floorRatio(target: number, ratio: number): number {
  return Math.floor(target * ratio + 1e-9);
}

export function daysBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function assignTicketQuarter(input: { quarterId?: string; closureDate?: string; month?: string; assignDate?: string }): string | undefined {
  if (input.quarterId) return input.quarterId;
  return quarterIdFromDate(input.closureDate) ?? quarterIdFromDate(input.month) ?? quarterIdFromDate(input.assignDate) ?? undefined;
}

export function quarterIdFromDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getUTCMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `q${quarter}-${date.getUTCFullYear()}`;
}

export function quarterLabel(id: string): string {
  const match = /^q([1-4])-(\d{4})$/i.exec(id);
  if (!match) return id;
  return `Q${match[1]}-${match[2]}`;
}

export function quarterBounds(year: number, quarterNumber: number): { startDate: string; endDate: string } {
  const startMonth = (quarterNumber - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function parseQuarterLabel(label: string): { id: string; year: number; quarterNumber: number } | null {
  const match = /^Q([1-4])-(\d{4})$/i.exec(label.trim());
  if (!match) return null;
  const quarterNumber = Number(match[1]);
  const year = Number(match[2]);
  return { id: `q${quarterNumber}-${year}`, year, quarterNumber };
}

export function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
