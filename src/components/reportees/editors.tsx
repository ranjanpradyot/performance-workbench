"use client";

import { assignTicketQuarter, daysBetween, parseQuarterLabel, quarterLabel } from "@/domain/status";
import { checklistFormSchema, learningFormSchema, ticketFormSchema } from "@/domain/form-schemas";
import { overrideAssessment, removeChecklist, removeTicket, upsertChecklist, upsertLearning, upsertTicket } from "@/domain/mutations";
import type { AchievementStatus, KpiAssessment, LearningEvidence, OkrChecklistEntry, Ticket, WorkbenchDataset } from "@/domain/types";
import { touchQuarter } from "@/infrastructure/excel/dataset";
import { useWorkbench } from "@/state/workbench-context";
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const STATUSES: Array<[AchievementStatus, string]> = [
  ["pending", "Not assessed"],
  ["achieved", "Achieved"],
  ["not_achieved", "Not achieved"],
  ["not_applicable", "Not applicable"],
  ["insufficient_evidence", "Insufficient evidence"],
];

function optionalNumber(raw: string, label: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be zero or greater. Leave it blank when it is unknown. Blank is not stored as zero.`);
  return value;
}

function withQuarter(dataset: WorkbenchDataset, quarterId: string | undefined): WorkbenchDataset {
  if (!quarterId || dataset.quarters.some((item) => item.id === quarterId)) return dataset;
  const parsed = parseQuarterLabel(quarterLabel(quarterId));
  if (!parsed) return dataset;
  const next = structuredClone(dataset);
  touchQuarter(next, parsed.year, parsed.quarterNumber);
  return next;
}

export function ChecklistEditor({ personId, personName, entry, open, onClose }: { personId: string; personName: string; entry: OkrChecklistEntry | null; open: boolean; onClose: () => void }) {
  const { dataset, commit, notify } = useWorkbench();
  const form = useForm({ defaultValues: checklistDefaults(entry) });
  const [markEarlier, setMarkEarlier] = useState(true);
  useEffect(() => { if (open) form.reset(checklistDefaults(entry)); }, [open, entry, form]);
  if (!dataset) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{entry ? "Edit OKR line" : "Add OKR line"}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="checklist-form" spacing={1.5} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (values) => {
          const parsed = checklistFormSchema.safeParse(values);
          if (!parsed.success) { notify(parsed.error.issues[0]?.message ?? "Check the OKR form.", "error"); return; }
          try {
            const weightage = optionalNumber(parsed.data.weightage, "Weightage");
            const record: OkrChecklistEntry = {
              id: entry?.id ?? `okr_${personId}_${crypto.randomUUID().slice(0, 8)}`,
              reporteeId: personId,
              quarterId: parsed.data.quarterId,
              employeeName: personName,
              kpiAffected: parsed.data.kpiAffected,
              okrMet: parsed.data.okrMet,
              weightage,
              artifacts: parsed.data.artifacts?.trim() || undefined,
              otherLinks: parsed.data.otherLinks?.trim() || undefined,
              okrs: parsed.data.okrs,
              deliverableExpected: parsed.data.deliverableExpected?.trim() || undefined,
              evidenceNote: parsed.data.evidenceNote?.trim() || undefined,
              updatedAt: new Date().toISOString(),
            };
            const base = withQuarter(dataset, record.quarterId) ?? dataset;
            await commit(upsertChecklist(base, record, { markEarlierQuartersNotApplicable: !entry && markEarlier }), entry ? "Edit OKR" : "Add OKR");
            onClose();
          } catch (cause) {
            notify(cause instanceof Error ? cause.message : "The OKR line could not be saved.", "error");
          }
        })}>
          <Controller name="quarterId" control={form.control} render={({ field }) => <TextField select label="Quarter" value={field.value} onChange={field.onChange}>{dataset.quarters.map((quarter) => <MenuItem key={quarter.id} value={quarter.id}>{quarter.label}</MenuItem>)}</TextField>} />
          <TextField label="KPI affected" {...form.register("kpiAffected")} />
          <Controller name="okrMet" control={form.control} render={({ field }) => <TextField select label="OKR met?" value={field.value} onChange={field.onChange}>{STATUSES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>} />
          <TextField label="Pointers" helperText="Leave blank when this line has no pointers. Blank is not zero. A quarter cannot total more than 100. Not applicable lines are not counted." {...form.register("weightage")} />
          {!entry && <FormControlLabel control={<Checkbox checked={markEarlier} onChange={(event) => setMarkEarlier(event.target.checked)} />} label="Mark earlier quarters this year as not applicable" />}
          <TextField label="OKRs" multiline minRows={3} {...form.register("okrs")} />
          <TextField label="Deliverable expected" multiline minRows={2} {...form.register("deliverableExpected")} />
          <TextField label="Evidence note" multiline minRows={2} {...form.register("evidenceNote")} />
          <TextField label="Evidence" helperText="A web address, or the workbook evidence this OKR points to. Existing workbook references are kept as they are for the Excel export." {...form.register("artifacts")} />
          <TextField label="More evidence" {...form.register("otherLinks")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {entry && <Button color="warning" onClick={() => {
          if (!window.confirm("Delete this OKR line? The checklist export will no longer include it. KPI assessments are not deleted.")) return;
          void commit(removeChecklist(dataset, entry.id), "Delete OKR").then(onClose);
        }}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="checklist-form" variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export function TicketEditor({ personId, entry, open, onClose }: { personId: string; entry: Ticket | null; open: boolean; onClose: () => void }) {
  const { dataset, commit, notify } = useWorkbench();
  const form = useForm({ defaultValues: ticketDefaults(entry) });
  useEffect(() => { if (open) form.reset(ticketDefaults(entry)); }, [open, entry, form]);
  const values = form.getValues();
  const derived = assignTicketQuarter({ closureDate: values.closureDate, month: values.month, assignDate: values.assignDate });
  if (!dataset) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{entry ? `Ticket ${entry.ticketNo}` : "Add ticket"}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="ticket-form" spacing={1.5} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (raw) => {
          const parsed = ticketFormSchema.safeParse(raw);
          if (!parsed.success) { notify(parsed.error.issues[0]?.message ?? "Check the ticket form.", "error"); return; }
          try {
            const quarterId = parsed.data.quarterId || derived;
            const codeLines = optionalNumber(parsed.data.codeLines, "Code lines");
            const sqlLines = optionalNumber(parsed.data.sqlLines, "SQL lines");
            let cycleDays = optionalNumber(parsed.data.cycleDays, "Cycle days");
            if (cycleDays == null && parsed.data.assignDate && parsed.data.closureDate) cycleDays = daysBetween(parsed.data.assignDate, parsed.data.closureDate);
            const ticket: Ticket = {
              id: entry?.id ?? `tkt_${personId}_${parsed.data.ticketNo}_${quarterId ?? crypto.randomUUID().slice(0, 8)}`,
              reporteeId: personId,
              ticketNo: parsed.data.ticketNo,
              description: parsed.data.description?.trim() || undefined,
              status: parsed.data.status?.trim() || undefined,
              month: parsed.data.month?.trim() || undefined,
              assignDate: parsed.data.assignDate?.trim() || undefined,
              closureDate: parsed.data.closureDate?.trim() || undefined,
              owner: parsed.data.owner?.trim() || undefined,
              spChange: parsed.data.spChange?.trim() || undefined,
              codeChange: parsed.data.codeChange?.trim() || undefined,
              codeLines,
              sqlLines,
              quarterId,
              cycleDays,
              azurePrUrl: parsed.data.azurePrUrl?.trim() || undefined,
              defectLike: entry?.defectLike,
              updatedAt: new Date().toISOString(),
            };
            const base = withQuarter(dataset, quarterId) ?? dataset;
            await commit(upsertTicket(base, ticket), entry ? "Edit ticket" : "Add ticket");
            onClose();
          } catch (cause) {
            notify(cause instanceof Error ? cause.message : "The ticket could not be saved.", "error");
          }
        })}>
          <TextField label="Ticket No." {...form.register("ticketNo")} />
          <TextField label="Description" multiline minRows={2} {...form.register("description")} />
          <TextField label="Status" {...form.register("status")} />
          <Controller name="quarterId" control={form.control} render={({ field }) => (
            <TextField select label="Quarter" value={field.value} onChange={field.onChange} helperText={field.value ? "The selected quarter is stored as entered." : derived ? `Blank uses Closure, else Month, else Assign Date: ${quarterLabel(derived)}.` : "Enter a quarter or a closure, month, or assign date."}>
              <MenuItem value="">Derive from dates</MenuItem>
              {dataset.quarters.map((quarter) => <MenuItem key={quarter.id} value={quarter.id}>{quarter.label}</MenuItem>)}
            </TextField>
          )} />
          <TextField label="Month" type="date" slotProps={{ inputLabel: { shrink: true } }} {...form.register("month")} />
          <TextField label="Assign date" type="date" slotProps={{ inputLabel: { shrink: true } }} {...form.register("assignDate")} />
          <TextField label="Closure date" type="date" slotProps={{ inputLabel: { shrink: true } }} {...form.register("closureDate")} />
          <TextField label="Owner" {...form.register("owner")} />
          <TextField label="SP change" {...form.register("spChange")} />
          <TextField label="Code change" {...form.register("codeChange")} />
          <TextField label="Code lines" helperText="Leave blank when unknown." {...form.register("codeLines")} />
          <TextField label="SQL lines" {...form.register("sqlLines")} />
          <TextField label="Cycle days" helperText="Filled from assign and closure dates when left blank." {...form.register("cycleDays")} />
          <TextField label="PR URL" {...form.register("azurePrUrl")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {entry && <Button color="warning" onClick={() => {
          if (!window.confirm(`Remove ticket ${entry.ticketNo} from the master? Quarterly sheets are rebuilt from the master, so this evidence will leave those views too.`)) return;
          void commit(removeTicket(dataset, entry.id), "Delete ticket").then(onClose);
        }}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="ticket-form" variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export function LearningEditor({ personId, entry, open, onClose }: { personId: string; entry: LearningEvidence | null; open: boolean; onClose: () => void }) {
  const { dataset, commit, notify } = useWorkbench();
  const form = useForm({ defaultValues: learningDefaults(entry) });
  useEffect(() => { if (open) form.reset(learningDefaults(entry)); }, [open, entry, form]);
  if (!dataset) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{entry ? "Edit learning evidence" : "Add learning evidence"}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="learning-form" spacing={1.5} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (raw) => {
          const parsed = learningFormSchema.safeParse(raw);
          if (!parsed.success) { notify(parsed.error.issues[0]?.message ?? "Check the learning form.", "error"); return; }
          const record: LearningEvidence = {
            id: entry?.id ?? `lrn_${personId}_${crypto.randomUUID().slice(0, 8)}`,
            reporteeId: personId,
            quarterId: parsed.data.quarterId,
            kpi: parsed.data.kpi?.trim() || undefined,
            focusArea: parsed.data.focusArea,
            problemStatement: parsed.data.problemStatement?.trim() || undefined,
            evidenceLink: parsed.data.evidenceLink?.trim() || undefined,
            status: parsed.data.status,
            comments: parsed.data.comments?.trim() || undefined,
            updatedAt: new Date().toISOString(),
          };
          const base = withQuarter(dataset, record.quarterId) ?? dataset;
          await commit(upsertLearning(base, record), entry ? "Edit learning evidence" : "Add learning evidence");
          onClose();
        })}>
          <Controller name="quarterId" control={form.control} render={({ field }) => <TextField select label="Quarter" value={field.value} onChange={field.onChange}>{dataset.quarters.map((quarter) => <MenuItem key={quarter.id} value={quarter.id}>{quarter.label}</MenuItem>)}</TextField>} />
          <TextField label="KPI" {...form.register("kpi")} />
          <TextField label="POC / focus area" {...form.register("focusArea")} />
          <TextField label="Problem statement" multiline minRows={2} helperText="Text here does not mark the item achieved." {...form.register("problemStatement")} />
          <TextField label="Evidence link" {...form.register("evidenceLink")} />
          <Controller name="status" control={form.control} render={({ field }) => <TextField select label="Achievement" value={field.value} onChange={field.onChange}>{STATUSES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>} />
          <TextField label="Comments" multiline minRows={2} {...form.register("comments")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="learning-form" variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export function OverrideEditor({ assessment, open, onClose }: { assessment: KpiAssessment | null; open: boolean; onClose: () => void }) {
  const { dataset, commit, notify } = useWorkbench();
  const form = useForm({ defaultValues: { status: assessment?.status ?? "achieved", reason: "" } });
  useEffect(() => { if (open) form.reset({ status: assessment?.status ?? "achieved", reason: "" }); }, [open, assessment, form]);
  if (!dataset || !assessment) return null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Override assessment</DialogTitle>
      <DialogContent>
        <Stack component="form" id="override-form" spacing={1.5} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (values) => {
          try {
            await commit(overrideAssessment(dataset, assessment.id, values.status, values.reason), "Override assessment");
            onClose();
          } catch (cause) {
            notify(cause instanceof Error ? cause.message : "The override was not saved.", "error");
          }
        })}>
          <Controller name="status" control={form.control} render={({ field }) => <TextField select label="Status" value={field.value} onChange={field.onChange}>{STATUSES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>} />
          <TextField label="Reason" multiline minRows={2} helperText="Required. The previous result stays on the record as the calculated status." {...form.register("reason")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="override-form" variant="contained">Save override</Button>
      </DialogActions>
    </Dialog>
  );
}

function checklistDefaults(entry: OkrChecklistEntry | null) {
  return {
    quarterId: entry?.quarterId ?? "",
    kpiAffected: entry?.kpiAffected ?? "",
    okrMet: entry?.okrMet ?? "pending",
    weightage: entry?.weightage == null ? "" : String(entry.weightage),
    okrs: entry?.okrs ?? "",
    deliverableExpected: entry?.deliverableExpected ?? "",
    evidenceNote: entry?.evidenceNote ?? "",
    artifacts: entry?.artifacts ?? "",
    otherLinks: entry?.otherLinks ?? "",
  };
}

function ticketDefaults(entry: Ticket | null) {
  return {
    ticketNo: entry?.ticketNo ?? "",
    description: entry?.description ?? "",
    status: entry?.status ?? "",
    month: entry?.month ?? "",
    assignDate: entry?.assignDate ?? "",
    closureDate: entry?.closureDate ?? "",
    owner: entry?.owner ?? "",
    spChange: entry?.spChange ?? "",
    codeChange: entry?.codeChange ?? "",
    codeLines: entry?.codeLines == null ? "" : String(entry.codeLines),
    sqlLines: entry?.sqlLines == null ? "" : String(entry.sqlLines),
    cycleDays: entry?.cycleDays == null ? "" : String(entry.cycleDays),
    quarterId: entry?.quarterId ?? "",
    azurePrUrl: entry?.azurePrUrl ?? "",
  };
}

function learningDefaults(entry: LearningEvidence | null) {
  return {
    quarterId: entry?.quarterId ?? "",
    kpi: entry?.kpi ?? "",
    focusArea: entry?.focusArea ?? "",
    problemStatement: entry?.problemStatement ?? "",
    evidenceLink: entry?.evidenceLink ?? "",
    status: entry?.status ?? "pending",
    comments: entry?.comments ?? "",
  };
}
