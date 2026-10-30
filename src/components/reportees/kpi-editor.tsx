"use client";

import { annualPointersUsed, addKpi, kpiStartQuarterId, removeKpi, updateKpi, POINTER_CAP } from "@/domain/mutations";
import type { KpiDefinition, Quarter } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

function sortedQuarters(quarters: Quarter[]): Quarter[] {
  return [...quarters].sort((left, right) => left.year - right.year || left.quarterNumber - right.quarterNumber);
}

function quarterContainingToday(quarters: Quarter[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return quarters.find((quarter) => quarter.startDate <= today && quarter.endDate >= today)?.id ?? quarters[quarters.length - 1]?.id ?? "";
}

export function KpiEditor({ personId, definition, open, onClose }: { personId: string; definition: KpiDefinition | null; open: boolean; onClose: () => void }) {
  const { dataset, commit, notify } = useWorkbench();
  const form = useForm({ defaultValues: { name: "", category: "Delivery", pointers: "", description: "", startQuarterId: "" } });
  useEffect(() => {
    if (!open || !dataset) return;
    const quarters = sortedQuarters(dataset.quarters);
    form.reset({
      name: definition?.sourceLabel ?? "",
      category: definition?.category ?? "Delivery",
      pointers: definition?.annualWeight == null ? "" : String(definition.annualWeight),
      description: definition?.description ?? "",
      startQuarterId: definition ? kpiStartQuarterId(dataset, definition.id) : quarterContainingToday(quarters),
    });
  }, [open, definition, dataset, form]);
  const startQuarterId = useWatch({ control: form.control, name: "startQuarterId" });
  const pointerText = useWatch({ control: form.control, name: "pointers" });
  if (!dataset) return null;
  const quarters = sortedQuarters(dataset.quarters);
  const start = quarters.find((quarter) => quarter.id === startQuarterId);
  const pointers = Number(pointerText);
  const used = start ? annualPointersUsed(dataset, personId, start.year, definition?.id) : 0;
  const earlier = start ? quarters.filter((quarter) => quarter.year === start.year && quarter.quarterNumber < start.quarterNumber) : [];
  const later = start ? quarters.filter((quarter) => quarter.year === start.year && quarter.quarterNumber >= start.quarterNumber) : [];
  const fullAnnual = dataset.assessmentRules.find((item) => item.reporteeId === personId)?.scoreModel === "full_annual_each_quarter";
  const eachQuarter = Number.isFinite(pointers) ? Math.round((fullAnnual ? pointers : pointers / 4) * 100) / 100 : 0;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{definition ? "Edit KPI" : "Add KPI"}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="kpi-form" spacing={1.5} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (values) => {
          try {
            const input = {
              name: values.name,
              category: values.category,
              pointers: Number(values.pointers),
              description: values.description,
              startQuarterId: values.startQuarterId,
            };
            const next = definition ? updateKpi(dataset, definition.id, input) : addKpi(dataset, personId, input);
            await commit(next, definition ? "Edit KPI" : "Add KPI");
            onClose();
          } catch (cause) {
            notify(cause instanceof Error ? cause.message : "The KPI could not be saved.", "error");
          }
        })}>
          <TextField label="KPI name" {...form.register("name")} />
          <TextField label="Category" {...form.register("category")} />
          <TextField label="Pointers" type="number" helperText={start ? `${used} of ${POINTER_CAP} pointers already used in ${start.year}. This KPI's pointers count for the whole year, even where earlier quarters are not applicable.` : "Annual pointers. The year cannot total more than 100."} {...form.register("pointers")} />
          <Controller name="startQuarterId" control={form.control} render={({ field }) => (
            <TextField select label="Starts in" value={field.value} onChange={field.onChange} helperText="Quarters before this one are saved as not applicable and do not use pointers. A Yes or No already recorded on a quarter is kept.">
              {quarters.map((quarter) => <MenuItem key={quarter.id} value={quarter.id}>{quarter.label}</MenuItem>)}
            </TextField>
          )} />
          <TextField label="Description" multiline minRows={2} {...form.register("description")} />
          {start && (
            <Typography variant="body2" color="text.secondary">
              {definition
                ? "Earlier quarters that already have this KPI, and are still not assessed, become not applicable. A recorded Yes or No is kept."
                : earlier.length
                  ? `${earlier.map((quarter) => quarter.label).join(", ")} will be not applicable.`
                  : "No earlier quarter in this year."}
              {" "}
              {later.map((quarter) => quarter.label).join(", ")} {later.length === 1 ? "stays" : "stay"} in scope
              {Number.isFinite(pointers) && pointerText?.trim() ? ` at ${eachQuarter} pointers each quarter.` : "."}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {definition && <Button color="warning" onClick={() => {
          if (!window.confirm(`Delete ${definition.sourceLabel}? Its quarter rows are removed. OKR checklist lines are kept.`)) return;
          void commit(removeKpi(dataset, definition.id), "Delete KPI").then(onClose);
        }}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="kpi-form" variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
