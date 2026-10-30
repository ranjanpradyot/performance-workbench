"use client";

import { Alert } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useWorkbench } from "@/state/workbench-context";

export default function ReporteesPage() {
  const { dataset } = useWorkbench();
  const router = useRouter();
  const redirected = useRef(false);
  const firstId = (dataset?.reportees.find((person) => person.status === "active") ?? dataset?.reportees[0])?.id;

  useEffect(() => {
    if (!firstId || redirected.current) return;
    redirected.current = true;
    router.replace(`/reportees/${firstId}`);
  }, [firstId, router]);

  if (dataset && !firstId) return <Alert severity="info">No reportees yet. Add one from Settings.</Alert>;
  return null;
}
