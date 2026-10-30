"use client";

import { useLayoutEffect, useRef } from "react";
import { Avatar, Box, ButtonBase, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { statusColor, StatusIcon } from "@/components/feedback/status-chip";
import { scoreText, StatusLegend } from "@/components/scores/quarter-score";
import { formatMetric, type QuarterScore } from "@/domain/dashboard";
import type { AchievementStatus } from "@/domain/types";
import { reporteeForeground } from "@/theme/reportee-colors";

export interface ScorePerson {
  id: string;
  name: string;
  color: string;
}

type ScoreKpi = QuarterScore["kpis"][number];

export function ScoreInfographic({ quarters, rows, onOpen }: { quarters: Array<{ id: string; label: string }>; rows: Array<{ person: ScorePerson; scores: QuarterScore[] }>; onOpen: (id: string) => void }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const layoutKey = `${quarters.map((quarter) => quarter.id).join()}|${rows.map((row) => `${row.person.id}:${row.scores.map((score) => score.kpis.length).join(",")}`).join(";")}`;
  const columns = `168px repeat(${Math.max(quarters.length, 1)}, minmax(188px, 1fr))`;
  useLayoutEffect(() => {
    const root = boardRef.current;
    if (!root) return;
    const fit = () => {
      const plates = [...root.querySelectorAll<HTMLElement>("[data-quarter-plate]")];
      if (!plates.length) return;
      for (const plate of plates) plate.style.minHeight = "auto";
      const max = Math.ceil(Math.max(...plates.map((plate) => plate.getBoundingClientRect().height)));
      for (const plate of plates) plate.style.minHeight = `${max}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [layoutKey]);
  return (
    <Stack spacing={1.5} component="section" aria-label="Quarter-wise score" sx={{ "@keyframes plate-in": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } } }}>
      <Box>
        <Typography variant="h6">Quarter-wise score</Typography>
        <Typography variant="body2" color="text.secondary">Each plate is one quarter. A new quarter adds a plate. A red line names the KPI that was not met. An open line with no Yes or No still shows the actual written in the sheet.</Typography>
      </Box>
      <StatusLegend />
      {rows.length === 0 && <Typography color="text.secondary">No reportees match the dashboard filters.</Typography>}
      {rows.length > 0 && (
        <Box ref={boardRef} sx={{ overflowX: "auto", pb: 0.5 }}>
          <Box sx={{ minWidth: 168 + quarters.length * 200 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: columns, gap: 1, mb: 1, px: 0.25 }}>
              <Box />
              {quarters.map((quarter, index) => (
                <Typography key={quarter.id} variant="caption" sx={{ fontWeight: 700, textAlign: "center", animation: "plate-in 500ms ease-out both", animationDelay: `${index * 50}ms` }}>{quarter.label}</Typography>
              ))}
            </Box>
            <Stack spacing={1}>
              {rows.map(({ person, scores }) => (
                <PersonRail key={person.id} person={person} quarters={quarters} scores={scores} columns={columns} onOpen={() => onOpen(person.id)} />
              ))}
            </Stack>
          </Box>
        </Box>
      )}
    </Stack>
  );
}

function PersonRail({ person, quarters, scores, columns, onOpen }: { person: ScorePerson; quarters: Array<{ id: string; label: string }>; scores: QuarterScore[]; columns: string; onOpen: () => void }) {
  const mode = useTheme().palette.mode;
  const total = totalOf(scores);
  return (
    <ButtonBase onClick={onOpen} sx={{ display: "grid", gridTemplateColumns: columns, alignItems: "stretch", gap: 1, width: "100%", textAlign: "left", p: 1, borderRadius: "14px", border: "1px solid", borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "#DDE2E9", bgcolor: "background.paper", "&:hover": { bgcolor: mode === "dark" ? "rgba(255,255,255,0.04)" : "#F7F8FA" } }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
        <Avatar sx={{ bgcolor: person.color, color: reporteeForeground(person.color), width: 36, height: 36, fontSize: 15 }}>{person.name.slice(0, 1)}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{person.name}</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{scoreText(total)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{total.unassessed > 0 ? `${formatMetric(total.unassessed)} not assessed` : "All decided"}</Typography>
        </Box>
      </Stack>
      {quarters.map((quarter, index) => (
        <QuarterPlate key={quarter.id} label={quarter.label} score={scores.find((item) => item.quarterId === quarter.id)} delay={index * 50} />
      ))}
    </ButtonBase>
  );
}

function QuarterPlate({ label, score, delay }: { label: string; score: QuarterScore | undefined; delay: number }) {
  const mode = useTheme().palette.mode;
  const tone = plateTone(score);
  const color = statusColor(tone, mode);
  const lines = [...(score?.kpis ?? [])].sort((a, b) => lineRank(a) - lineRank(b));
  const missed = lines.filter((kpi) => kpi.status === "not_achieved");
  return (
    <Box data-quarter-plate="" sx={{ height: "100%", p: 1.25, borderRadius: "12px", border: "1px solid", borderColor: alpha(color, 0.45), bgcolor: alpha(color, mode === "dark" ? 0.16 : 0.08), display: "flex", flexDirection: "column", gap: 0.75, animation: "plate-in 560ms ease-out both", animationDelay: `${delay}ms` }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <StatusIcon status={score?.status ?? "pending"} title={score ? `${label}: ${scoreText(score)}` : label} />
        <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{score ? scoreText(score) : "—"}</Typography>
      </Stack>
      {missed.length > 0 && <Typography variant="caption" sx={{ fontWeight: 700, color: statusColor("not_achieved", mode) }}>Not met</Typography>}
      <Stack spacing={0.5}>
        {lines.map((kpi) => <KpiLine key={kpi.id} kpi={kpi} />)}
      </Stack>
      {score && score.unassessed > 0 && <Typography variant="caption" color="text.secondary">{formatMetric(score.unassessed)} not assessed</Typography>}
    </Box>
  );
}

function KpiLine({ kpi }: { kpi: ScoreKpi }) {
  const mode = useTheme().palette.mode;
  const missed = kpi.status === "not_achieved";
  const open = kpi.points == null && kpi.weight != null && kpi.status !== "not_applicable";
  const tone: AchievementStatus = missed ? "not_achieved" : open ? "pending" : kpi.status === "not_applicable" ? "not_applicable" : "achieved";
  const color = statusColor(tone, mode);
  const detail = missed ? `${formatMetric(kpi.weight)} missed` : open ? `${formatMetric(kpi.weight)} open` : kpi.status === "not_applicable" ? "n/a" : formatMetric(kpi.points);
  const note = open && kpi.actual ? kpi.actual : undefined;
  const url = note?.match(/https?:\/\/\S+/)?.[0];
  const prose = note?.replace(url ?? "", "").trim();
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start", minWidth: 0 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "2px", flexShrink: 0, mt: "4px", bgcolor: missed || !open ? color : mode === "dark" ? "rgba(255,160,80,0.18)" : "#FDE7CC", backgroundImage: open ? `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 3px)` : undefined }} />
        <Typography variant="caption" sx={{ flex: 1, minWidth: 0, lineHeight: 1.3, fontWeight: missed ? 700 : 500, color: missed ? color : "text.primary" }}>{kpi.name}</Typography>
        <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: missed ? color : "text.secondary" }}>{detail}</Typography>
      </Stack>
      {prose && <Typography variant="caption" color="text.secondary" sx={{ display: "block", pl: "14px", lineHeight: 1.3 }}>{prose}</Typography>}
      {url && <Box component="a" href={url} target="_blank" rel="noreferrer" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} sx={{ display: "block", pl: "14px", color: mode === "dark" ? "#6E9BFF" : "#004FCC", fontSize: 11, lineHeight: 1.3, wordBreak: "break-all" }}>{url}</Box>}
    </Box>
  );
}

function lineRank(kpi: ScoreKpi): number {
  if (kpi.status === "not_achieved") return 0;
  if (kpi.points == null && kpi.status !== "not_applicable") return 1;
  if (kpi.status === "not_applicable") return 3;
  return 2;
}

function plateTone(score: QuarterScore | undefined): AchievementStatus {
  if (!score || score.achieved == null) return "pending";
  if (score.kpis.some((kpi) => kpi.status === "not_achieved")) return "not_achieved";
  return "achieved";
}

function totalOf(scores: QuarterScore[]): QuarterScore {
  const kpis = scores.flatMap((score) => score.kpis);
  const decided = kpis.filter((kpi) => kpi.points != null && kpi.weight != null);
  const unassessed = kpis.filter((kpi) => kpi.points == null && kpi.weight != null && kpi.status !== "not_applicable").reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0);
  const achieved = decided.length ? decided.reduce((sum, kpi) => sum + (kpi.points ?? 0), 0) : null;
  const possible = decided.length ? decided.reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0) : null;
  const status: AchievementStatus = scores.some((score) => score.status === "not_achieved") ? "not_achieved" : achieved != null ? "achieved" : "pending";
  return { quarterId: "total", label: "Total", achieved, possible, unassessed, status, kpis };
}
