"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { reporteeFormSchema } from "@/domain/form-schemas";
import { addReportee, setReporteeStatus, updateReportee, type ReporteeInput } from "@/domain/mutations";
import type { Reportee } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";
import { reporteeColor } from "@/theme/reportee-colors";

const empty: ReporteeInput = { fullName: "", employeeId: "", role: "", team: "", manager: "", joiningDate: "", themeColor: reporteeColor(0), notes: "" };

export function ReporteeDialog({ open, person, onClose, onSaved }: { open: boolean; person: Reportee | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { dataset, commit, notify } = useWorkbench();
  const form = useForm<ReporteeInput>({ defaultValues: empty });

  useEffect(() => {
    if (!open || !dataset) return;
    form.reset(person
      ? { ...empty, ...person, employeeId: person.employeeId ?? "", role: person.role ?? "", team: person.team ?? "", manager: person.manager ?? "", joiningDate: person.joiningDate ?? "", notes: person.notes ?? "" }
      : { ...empty, themeColor: reporteeColor(dataset.reportees.length) });
  }, [open, person, dataset, form]);

  async function onSubmit(values: ReporteeInput) {
    if (!dataset) return;
    const parsed = reporteeFormSchema.safeParse(values);
    if (!parsed.success) {
      notify(parsed.error.issues[0]?.message ?? "Check the form.", "error");
      return;
    }
    try {
      const known = new Set(dataset.reportees.map((item) => item.id));
      const next = person ? updateReportee(dataset, person.id, parsed.data) : addReportee(dataset, parsed.data);
      await commit(next, person ? "Edit reportee" : "Add reportee");
      onSaved(person?.id ?? next.reportees.find((item) => !known.has(item.id))?.id ?? "");
      onClose();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "The reportee could not be saved.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{person ? `Edit ${person.fullName}` : "Add reportee"}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="reportee-form" spacing={1.5} sx={{ mt: 1 }} onSubmit={form.handleSubmit(onSubmit)}>
          <TextField label="Full name" {...form.register("fullName")} />
          <TextField label="Employee ID" helperText="Leave blank when the workbook has none. Duplicates are rejected." {...form.register("employeeId")} />
          <TextField label="Role" {...form.register("role")} />
          <TextField label="Team" {...form.register("team")} />
          <TextField label="Manager" {...form.register("manager")} />
          <TextField label="Joining date" type="date" slotProps={{ inputLabel: { shrink: true } }} {...form.register("joiningDate")} />
          <TextField label="Tab colour" type="color" helperText="Used for this reportee's tab, header, and charts." {...form.register("themeColor")} />
          <TextField label="Notes" multiline minRows={2} {...form.register("notes")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {person && <Button color="warning" onClick={() => {
          if (!dataset) return;
          const restoring = person.status === "archived";
          if (!restoring && !window.confirm(`Archive ${person.fullName}? Historical quarters, tickets, and evidence stay in the workbook.`)) return;
          const nextStatus = restoring ? "active" : "archived";
          void commit(
            setReporteeStatus(dataset, person.id, nextStatus, restoring ? "Restored from Settings." : "Archived from Settings. Historical appraisals stay linked to the internal id."),
            restoring ? "Restore reportee" : "Archive reportee",
          ).then(onClose);
        }}>{person.status === "archived" ? "Restore" : "Archive"}</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="reportee-form" variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
