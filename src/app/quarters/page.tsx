"use client";

import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { PageFilters, SelectField } from "@/components/layout/filter-bar";
import { MoleculeCard } from "@/components/molecule/molecule-card";
import { quarterFormSchema } from "@/domain/form-schemas";
import { createQuarter, setQuarterStatus } from "@/domain/mutations";
import type { QuarterStatus } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";
import { accentForMode } from "@/theme/reportee-colors";

const LIFECYCLE: Record<QuarterStatus, { label: string; color: string }> = {
  planning: { label: "Planning", color: "#2A6BEF" },
  in_progress: { label: "In progress", color: "#004FCC" },
  under_review: { label: "Under review", color: "#F88800" },
  finalized: { label: "Finalized", color: "#0E7A4D" },
  archived: { label: "Archived", color: "#6B7280" },
};

interface QuarterForm {
  year: number;
  quarterNumber: number;
  notes?: string;
}

export default function QuartersPage() {
  const { dataset, commit, notify } = useWorkbench();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [year, setYear] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");
  const mode = useTheme().palette.mode;
  const form = useForm<QuarterForm>({ defaultValues: { year: 2026, quarterNumber: 3, notes: "" } });
  if (!dataset) return <Typography>Loading quarters…</Typography>;
  const years = [...new Set(dataset.quarters.map((quarter) => quarter.year))].sort();
  const quarters = [...dataset.quarters]
    .sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber)
    .filter((quarter) => (year === "all" || String(quarter.year) === year) && (lifecycle === "all" || quarter.status === lifecycle));

  async function onSubmit(values: QuarterForm) {
    const parsed = quarterFormSchema.safeParse(values);
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? "Check the quarter.", "error");
      return;
    }
    try {
      await commit(createQuarter(dataset!, parsed.data.year, parsed.data.quarterNumber, selected, parsed.data.notes), "Create quarter");
      setOpen(false);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "The quarter could not be created.", "error");
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography variant="h4">Quarters</Typography>
        <Button variant="contained" onClick={() => { setSelected(dataset.reportees.filter((person) => person.status === "active").map((person) => person.id)); setOpen(true); }}>Add quarter</Button>
      </Stack>
      <PageFilters>
        <SelectField label="Year" value={year} onChange={setYear} options={[["all", "All years"], ...years.map((item) => [String(item), String(item)] as [string, string])]} />
        <SelectField label="Lifecycle" value={lifecycle} onChange={setLifecycle} options={[["all", "All stages"], ...Object.entries(LIFECYCLE).map(([id, look]) => [id, look.label] as [string, string])]} />
      </PageFilters>
      {quarters.length === 0 && <Typography color="text.secondary">No quarters match this filter.</Typography>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)", xl: "repeat(4, 1fr)" }, gap: 2 }}>
        {quarters.map((quarter) => {
          const look = LIFECYCLE[quarter.status];
          const tone = accentForMode(look.color, mode);
          return (
            <MoleculeCard
              key={quarter.id}
              accent={look.color}
              bar
              icon={<CalendarMonthOutlinedIcon />}
              headerEnd={<Box component="span" sx={{ px: 1.25, height: 28, display: "inline-flex", alignItems: "center", borderRadius: "14px", fontSize: 12, fontWeight: 600, color: tone, bgcolor: alpha(tone, 0.12) }}>{look.label}</Box>}
              title={quarter.label}
            >
              <Typography variant="body2" sx={{ color: "inherit" }}>{quarter.startDate} to {quarter.endDate}</Typography>
              <Box sx={{ mt: 2 }}>
                {quarter.status === "finalized" ? (
                  <Button onClick={() => {
                    const reason = window.prompt("Why is this finalized quarter being reopened?");
                    if (!reason) return;
                    void commit(setQuarterStatus(dataset, quarter.id, "under_review", reason), "Reopen quarter");
                  }}>Reopen</Button>
                ) : (
                  <Button onClick={() => {
                    if (!window.confirm(`Finalize ${quarter.label}? Later edits should go through reopen, which writes an audit entry.`)) return;
                    void commit(setQuarterStatus(dataset, quarter.id, "finalized", "Finalized from the quarter desk."), "Finalize quarter");
                  }}>Finalize</Button>
                )}
              </Box>
            </MoleculeCard>
          );
        })}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>New quarter</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Year" type="number" {...form.register("year", { valueAsNumber: true })} />
            <TextField label="Quarter number" type="number" {...form.register("quarterNumber", { valueAsNumber: true })} />
            <TextField label="Notes" {...form.register("notes")} />
            <Typography variant="subtitle2">Participating reportees</Typography>
            {dataset.reportees.filter((person) => person.status !== "archived").map((person) => (
              <FormControlLabel key={person.id} control={<Checkbox checked={selected.includes(person.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))} />} label={person.fullName} />
            ))}
            <Typography variant="body2" color="text.secondary">KPI definitions are copied as templates. Actuals and evidence are not copied.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={form.handleSubmit(onSubmit)}>Create</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
