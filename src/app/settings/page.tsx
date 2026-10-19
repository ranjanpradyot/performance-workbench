"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useWorkbench } from "@/state/workbench-context";

export default function SettingsPage() {
  const { dataset, undo } = useWorkbench();
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Settings and recovery</Typography>
      <Alert severity="warning">Browser data is not automatically encrypted or backed up. Clearing site data, or switching browser profile, removes the local workbook. Export JSON before you do either. There is no sign-in. Local access is not enterprise access control. Use a protected workstation.</Alert>
      <Typography>Schema {dataset?.schemaVersion}. Revision {dataset?.application.revision}. Last update {dataset?.application.updatedAt}.</Typography>
      <Typography>IndexedDB is the working copy. A downloaded JSON file is a backup. The app does not write that file unless you download it or connect a file below.</Typography>
      <FileSync />
      <Button onClick={() => void undo()}>Undo last saved change</Button>
      {dataset?.assessmentRules.map((rule) => (
        <Stack key={rule.id} spacing={0.5}>
          <Typography variant="h6">{dataset.reportees.find((person) => person.id === rule.reporteeId)?.fullName} rules v{rule.version}</Typography>
          <Typography variant="body2">Score model: {rule.scoreModel}. Velocity floor is {rule.velocity.thresholdRatio * 100}% of target. Spill is open ≤ {rule.spill.maxOpen} or spill ≤ {rule.spill.maxSpillPercent}%. SLA average ≤ {rule.sla.maxAverageCycleDays} days. Rework wait states {rule.rework.countWaitStates ? "count" : "do not count"}.</Typography>
          {rule.notes.map((note) => <Typography key={note} variant="body2">{note}</Typography>)}
        </Stack>
      ))}
      <Typography variant="body2">Audit entries: {dataset?.auditHistory.length ?? 0}</Typography>
    </Stack>
  );
}

function FileSync() {
  const { dataset, notify } = useWorkbench();
  const [fileName, setFileName] = useState<string>("");
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const [permission, setPermission] = useState<"disconnected" | "connected" | "needs-permission">("disconnected");

  async function connect() {
    if (!window.showOpenFilePicker) {
      notify("This browser cannot connect a local JSON file. Use Download JSON backup instead.", "warning");
      return;
    }
    const [next] = await window.showOpenFilePicker({ types: [{ description: "JSON", accept: { "application/json": [".json"] } }] });
    const state = await next.queryPermission?.({ mode: "readwrite" });
    setHandle(next);
    setFileName(next.name);
    setPermission(state === "granted" ? "connected" : "needs-permission");
  }

  return (
    <Stack spacing={1}>
      <Typography variant="h6">Optional JSON file</Typography>
      <Typography variant="body2">Status: {permission === "connected" ? `connected to ${fileName}` : permission === "needs-permission" ? `${fileName} needs permission` : "disconnected"}. IndexedDB stays usable either way. Permission is requested only after you click.</Typography>
      <Button variant="outlined" onClick={() => void connect()}>Connect a JSON file</Button>
      <Button variant="outlined" disabled={!handle || !dataset} onClick={async () => {
        if (!handle || !dataset) return;
        try {
          const granted = await handle.requestPermission?.({ mode: "readwrite" });
          if (granted && granted !== "granted") {
            setPermission("needs-permission");
            notify("Permission was not granted. The file was not written.", "warning");
            return;
          }
          const existing = await (await handle.getFile()).text();
          if (existing.trim()) {
            try {
              const parsed = JSON.parse(existing) as { application?: { revision?: number; updatedAt?: string } };
              const fileRevision = parsed.application?.revision ?? 0;
              if (fileRevision > dataset.application.revision) {
                const proceed = window.confirm(`The file is at revision ${fileRevision}, which is newer than this browser copy (${dataset.application.revision}). Overwrite it with the browser copy?`);
                if (!proceed) {
                  notify("The file was not changed.", "warning");
                  return;
                }
              }
            } catch {
              const proceed = window.confirm("The selected file is not valid JSON. Replace it with the current workbook?");
              if (!proceed) {
                notify("The file was not changed.", "warning");
                return;
              }
            }
          }
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(dataset, null, 2));
          await writable.close();
          setPermission("connected");
          notify(`The file ${handle.name} was written at revision ${dataset.application.revision}.`);
        } catch (cause) {
          notify(cause instanceof Error ? `The file was not updated. ${cause.message}` : "The file was not updated.", "error");
        }
      }}>Write the current workbook to the connected file</Button>
    </Stack>
  );
}
