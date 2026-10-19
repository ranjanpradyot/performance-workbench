"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultFilters, type Filters } from "@/domain/filters";
import type { WorkbenchDataset } from "@/domain/types";
import { mergeDatasets } from "@/infrastructure/excel/dataset";
import { DatasetRepository, PmsDatabase, seedIfEmpty } from "@/infrastructure/indexeddb/repository";
import { vibrantThemeColor } from "@/theme/reportee-colors";

export type { Filters };

interface WorkbenchContextValue {
  dataset: WorkbenchDataset | null;
  loading: boolean;
  error: string | null;
  saved: boolean;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  refresh: () => Promise<void>;
  commit: (next: WorkbenchDataset, undoLabel: string) => Promise<void>;
  undo: () => Promise<void>;
  notify: (message: string, severity?: "success" | "warning" | "error") => void;
  message: { text: string; severity: "success" | "warning" | "error" } | null;
  clearMessage: () => void;
  repository: DatasetRepository | null;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);
let repositorySingleton: DatasetRepository | null = null;

function repository(): DatasetRepository {
  if (!repositorySingleton) repositorySingleton = new DatasetRepository(new PmsDatabase());
  return repositorySingleton;
}

function readStoredFilters(): Filters {
  if (typeof window === "undefined") return defaultFilters;
  const stored = sessionStorage.getItem("pms-filters");
  if (!stored) return defaultFilters;
  try {
    return { ...defaultFilters, ...(JSON.parse(stored) as Partial<Filters>) };
  } catch {
    sessionStorage.removeItem("pms-filters");
    return defaultFilters;
  }
}

function withVibrantColors(dataset: WorkbenchDataset): WorkbenchDataset {
  let changed = false;
  const reportees = dataset.reportees.map((person) => {
    const themeColor = vibrantThemeColor(person.themeColor);
    if (themeColor === person.themeColor) return person;
    changed = true;
    return { ...person, themeColor };
  });
  return changed ? { ...dataset, reportees } : dataset;
}

async function loadBundledSeed(): Promise<WorkbenchDataset> {
  const response = await fetch("/seed/initial-dataset.json");
  if (!response.ok) throw new Error("The initial workbook seed could not be loaded. Use Import Excel to load a reportee workbook.");
  return response.json() as Promise<WorkbenchDataset>;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<WorkbenchDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [filters, setFilterState] = useState<Filters>(() => readStoredFilters());
  const [message, setMessage] = useState<WorkbenchContextValue["message"]>(null);

  const refresh = useCallback(async () => {
    try {
      const stored = await seedIfEmpty(repository(), loadBundledSeed);
      const loaded = withVibrantColors(stored);
      if (loaded !== stored) await repository().replace(loaded);
      setDataset(loaded);
      setError(null);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The local database could not be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // IndexedDB is outside React. The first read has to be applied after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the external store once
    void refresh();
  }, [refresh]);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    setFilterState((current) => {
      const next = { ...current, ...patch };
      sessionStorage.setItem("pms-filters", JSON.stringify(next));
      return next;
    });
  }, []);

  const commit = useCallback(async (next: WorkbenchDataset, undoLabel: string) => {
    setSaved(false);
    try {
      await repository().save(next, undoLabel);
      setDataset(await repository().load());
      setSaved(true);
      setMessage({ text: "Saved on this browser.", severity: "success" });
    } catch (cause) {
      setSaved(false);
      const text = cause instanceof Error ? cause.message : "Save failed.";
      const quota = text.toLowerCase().includes("quota");
      setMessage({
        text: quota
          ? "The browser storage quota was reached. Export a JSON backup, then free space before trying again."
          : `Save failed. ${text}`,
        severity: "error",
      });
      throw cause;
    }
  }, []);

  const undo = useCallback(async () => {
    const restored = await repository().undo();
    if (!restored) {
      setMessage({ text: "Nothing to undo.", severity: "warning" });
      return;
    }
    setDataset(restored);
    setMessage({ text: "The last saved edit was restored.", severity: "success" });
  }, []);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      dataset,
      loading,
      error,
      saved,
      filters,
      setFilters,
      refresh,
      commit,
      undo,
      notify: (text, severity = "success") => setMessage({ text, severity }),
      message,
      clearMessage: () => setMessage(null),
      repository: typeof window === "undefined" ? null : repository(),
    }),
    [dataset, loading, error, saved, filters, setFilters, refresh, commit, undo, message],
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchContextValue {
  const context = useContext(WorkbenchContext);
  if (!context) throw new Error("useWorkbench must be used inside WorkbenchProvider.");
  return context;
}

export function mergeImport(current: WorkbenchDataset, incoming: WorkbenchDataset): WorkbenchDataset {
  const merged = mergeDatasets([current, incoming]);
  merged.application.revision = current.application.revision;
  return merged;
}
