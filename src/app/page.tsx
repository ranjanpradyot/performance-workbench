"use client";

import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { Alert, Avatar, Box, ButtonBase, Card, CardActionArea, CardContent, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { statusColor, StatusIcon } from "@/components/feedback/status-chip";
import { MoleculeCard } from "@/components/molecule/molecule-card";
import { QuarterScoreCell, StatusLegend, scoreText } from "@/components/scores/quarter-score";
import { buildDashboard, formatMetric, quarterScores, type QuarterScore } from "@/domain/dashboard";
import type { AchievementStatus } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";
import { accentForMode, reporteeForeground } from "@/theme/reportee-colors";

const CARD_ACCENTS = ["#004FCC", "#F88800", "#0A2A5C", "#2A6BEF", "#0043B3", "#A55800"];

export default function DashboardPage() {
  const { dataset, loading, filters, setFilters } = useWorkbench();
  const router = useRouter();
  if (loading || !dataset) return <Typography>Loading the local workbench…</Typography>;
  const model = buildDashboard(dataset, filters);
  const scopeQuarterIds = dataset.quarters
    .filter((quarter) => (filters.quarterId === "all" || quarter.id === filters.quarterId) && (filters.year === "all" || String(quarter.year) === filters.year))
    .map((quarter) => quarter.id);
  const scoreRows = model.comparisons.map((person) => ({ person, scores: quarterScores(dataset, person.id, scopeQuarterIds) }));
  const scoreQuarters = [...dataset.quarters]
    .sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber)
    .filter((quarter) => scoreRows.some((row) => row.scores.some((score) => score.quarterId === quarter.id)));
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4">Appraisal desk</Typography>
        <Typography color="text.secondary">Missing evidence stays blank. A dash is not a failed quarter, and a real zero is shown as 0.</Typography>
      </Box>
      <Alert severity="info">This browser copy is not encrypted and is not an enterprise access control. Keep the workstation profile private and export a JSON backup.</Alert>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
        <MetricCard accent={CARD_ACCENTS[0]} icon={<GroupsOutlinedIcon />} title="Active reportees" value={String(model.activeReportees)} detail="People with an active profile" onClick={() => router.push("/reportees")} />
        <MetricCard accent={CARD_ACCENTS[1]} icon={<EventAvailableOutlinedIcon />} title="With selected quarter" value={model.reporteesWithQuarterData == null ? "—" : String(model.reporteesWithQuarterData)} detail={filters.quarterId === "all" ? "Choose a quarter to count coverage" : "Profiles that have quarter records"} onClick={() => router.push("/reportees")} />
        <MetricCard accent={CARD_ACCENTS[2]} icon={<InsightsOutlinedIcon />} title="KPI points" value={formatMetric(model.kpiPoints)} detail={model.kpiPossible == null ? "Not assessed" : `of ${formatMetric(model.kpiPossible)} in view`} onClick={() => setFilters({ status: "achieved" })} />
        <MetricCard accent={CARD_ACCENTS[3]} icon={<ChecklistOutlinedIcon />} title="OKR checklist" value={formatMetric(model.okrAchieved)} detail={model.okrPossible == null ? "Not assessed" : `of ${formatMetric(model.okrPossible)} line weight`} />
        <MetricCard status="achieved" title="Achieved KPIs" value={String(model.kpiAchieved)} detail="Yes awards the quarter weight" onClick={() => setFilters({ status: "achieved" })} />
        <MetricCard status="not_achieved" title="Not achieved" value={String(model.kpiNotAchieved)} detail="Recorded No. This is not the same as missing." onClick={() => setFilters({ status: "not_achieved" })} />
        <MetricCard status="pending" title="Not assessed" value={String(model.kpiPending)} detail="Pending or not yet scored" onClick={() => setFilters({ status: "pending" })} />
        <MetricCard status="not_applicable" title="Not applicable" value={String(model.kpiNotApplicable)} detail="Explicitly out of scope" onClick={() => setFilters({ status: "not_applicable" })} />
        <MetricCard accent={CARD_ACCENTS[4]} icon={<SchoolOutlinedIcon />} title="Learning achieved" value={`${model.learningAchieved}/${model.learningTotal || "—"}`} detail={`${model.learningPending} not assessed`} />
        <MetricCard accent={CARD_ACCENTS[5]} icon={<ConfirmationNumberOutlinedIcon />} title="Closed tickets" value={formatMetric(model.closedTickets, 0)} detail={model.totalTickets == null ? "No tickets in this view" : `${formatMetric(model.openTickets, 0)} open of ${formatMetric(model.totalTickets, 0)}`} />
      </Box>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 1.5 }}>
            <Box>
              <Typography variant="h6">Quarter-wise score</Typography>
              <Typography variant="body2" color="text.secondary">KPI points achieved out of the quarter weight. The icon is the worst decided KPI result in that quarter.</Typography>
            </Box>
          </Stack>
          <StatusLegend />
          <Box sx={{ overflowX: "auto", mt: 1.5 }}>
            <Table size="small" aria-label="Quarter-wise score">
              <TableHead>
                <TableRow>
                  <TableCell>Reportee</TableCell>
                  {scoreQuarters.map((quarter) => <TableCell key={quarter.id}>{quarter.label}</TableCell>)}
                  <TableCell>Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scoreRows.map(({ person, scores }) => (
                  <TableRow key={person.id} hover sx={{ cursor: "pointer" }} onClick={() => router.push(`/reportees/${person.id}`)}>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Avatar sx={{ bgcolor: person.color, color: reporteeForeground(person.color), width: 28, height: 28, fontSize: 13 }}>{person.name.slice(0, 1)}</Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{person.name}</Typography>
                      </Stack>
                    </TableCell>
                    {scoreQuarters.map((quarter) => <TableCell key={quarter.id}><QuarterScoreCell score={scores.find((score) => score.quarterId === quarter.id)} /></TableCell>)}
                    <TableCell><ScoreTotal scores={scores} /></TableCell>
                  </TableRow>
                ))}
                {scoreRows.length === 0 && <TableRow><TableCell colSpan={2}>No reportees match the dashboard filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: 1.5 }}>
        <Card>
          <CardContent>
            <Typography variant="h6">Closed tickets by quarter</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="closed" name="Closed" fill="#004FCC" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="target" name="Target" fill="#F88800" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6">Needs attention</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {model.attention.length === 0 && <Typography color="text.secondary">Nothing in the current filter needs a follow-up.</Typography>}
              {model.attention.slice(0, 8).map((item) => (
                <CardActionArea key={item.reason + item.reporteeId} onClick={() => router.push(`/reportees/${item.reporteeId}`)}>
                  <Box sx={{ px: 1, py: 0.5, display: "flex", gap: 1, alignItems: "flex-start" }}>
                    <StatusIcon status={item.tone === "error" ? "not_achieved" : "pending"} />
                    <Box>
                      <Typography variant="subtitle2">{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.reason}</Typography>
                    </Box>
                  </Box>
                </CardActionArea>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>
      <Card>
        <CardContent>
          <Typography variant="h6">Reportee comparison</Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {model.comparisons.map((person) => (
              <ComparisonRow key={person.id} person={person} onOpen={() => router.push(`/reportees/${person.id}`)} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

/** Decided KPIs only. Pending weight is listed beside the total so an unassessed quarter does not read as lost points. */
function ScoreTotal({ scores }: { scores: QuarterScore[] }) {
  const kpis = scores.flatMap((score) => score.kpis);
  const decided = kpis.filter((kpi) => kpi.points != null && kpi.weight != null);
  const pending = kpis.filter((kpi) => kpi.points == null && kpi.weight != null && kpi.status !== "not_applicable").reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0);
  const total = decided.length ? { achieved: decided.reduce((sum, kpi) => sum + (kpi.points ?? 0), 0), possible: decided.reduce((sum, kpi) => sum + (kpi.weight ?? 0), 0) } : { achieved: null, possible: null };
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{scoreText(total)}</Typography>
      {pending > 0 && <Typography variant="caption" color="text.secondary">{formatMetric(pending)} not assessed</Typography>}
    </Box>
  );
}

function ComparisonRow({ person, onOpen }: { person: { id: string; name: string; color: string; points: number | null; closed: number | null }; onOpen: () => void }) {
  const mode = useTheme().palette.mode;
  return (
    <ButtonBase onClick={onOpen} sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%", textAlign: "left", px: 1.5, py: 1.25, borderRadius: "8px", borderBottom: 1, borderColor: "divider", "&:hover": { bgcolor: mode === "dark" ? "rgba(255,255,255,0.04)" : "#F7F8FA" } }}>
      <Avatar sx={{ bgcolor: person.color, color: reporteeForeground(person.color), width: 36, height: 36, fontSize: 14 }}>{person.name.slice(0, 1)}</Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{person.name}</Typography>
        <Box sx={{ width: 28, height: 3, borderRadius: "2px", bgcolor: accentForMode(person.color, mode), mt: 0.5 }} />
      </Box>
      <Typography color="text.secondary">{person.points == null ? "Not assessed" : `${formatMetric(person.points)} pts`} · {person.closed == null ? "No tickets" : `${person.closed} closed`}</Typography>
    </ButtonBase>
  );
}

function MetricCard({ accent, status, icon, title, value, detail, onClick }: { accent?: string; status?: AchievementStatus; icon?: ReactNode; title: string; value: string; detail: string; onClick?: () => void }) {
  const mode = useTheme().palette.mode;
  const tone = status ? statusColor(status, mode) : accent ?? "#004FCC";
  return (
    <MoleculeCard
      accent={tone}
      wash
      icon={status ? <StatusIcon status={status} /> : icon}
      title={title}
      value={value}
      action={onClick ? "View" : undefined}
      onClick={onClick}
    >
      {detail}
    </MoleculeCard>
  );
}
