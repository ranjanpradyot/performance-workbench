"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { WorkbenchProvider } from "@/state/workbench-context";
import { buildTheme } from "@/theme/theme";

const ThemeModeContext = createContext<{ mode: "light" | "dark"; setMode: (mode: "light" | "dark") => void }>({
  mode: "light",
  setMode: () => undefined,
});

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

const MODE_KEY = "pms-workbench-theme";

export function Providers({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<"light" | "dark">("light");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.localStorage.getItem(MODE_KEY) === "dark") setModeState("dark");
  }, []);
  const setMode = useCallback((next: "light" | "dark") => {
    window.localStorage.setItem(MODE_KEY, next);
    setModeState(next);
  }, []);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ThemeModeContext.Provider value={{ mode, setMode }}>
          <WorkbenchProvider>{children}</WorkbenchProvider>
        </ThemeModeContext.Provider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
