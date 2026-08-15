"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { SYNC_STATUS_EVENT, type SyncStatusEventDetail } from "@/lib/sync-events";
import { cn } from "@/lib/utils";

export function SyncStatusBanner() {
  const [status, setStatus] = useState<SyncStatusEventDetail | null>(null);

  useEffect(() => {
    let hideTimer: number | undefined;

    function handleSyncStatus(event: Event) {
      const detail = (event as CustomEvent<SyncStatusEventDetail>).detail;
      window.clearTimeout(hideTimer);
      setStatus(detail);

      if (detail.status === "online") {
        hideTimer = window.setTimeout(() => setStatus(null), 2500);
      }
    }

    window.addEventListener(SYNC_STATUS_EVENT, handleSyncStatus);

    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
    };
  }, []);

  if (!status) {
    return null;
  }

  const Icon = status.status === "online" ? CheckCircle2 : status.status === "syncing" ? Loader2 : XCircle;

  return (
    <div
      className={cn(
        "fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[80] mx-auto flex max-w-3xl items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-2xl",
        status.status === "online"
          ? "border-emerald-300/30 bg-emerald-950/90 text-emerald-50"
          : status.status === "syncing"
            ? "border-neon-cyan/35 bg-moss-950/94 text-cyan-50 shadow-neon"
            : "border-alert-red/45 bg-[#351315]/94 text-red-50 shadow-neon-red"
      )}
      role={status.status === "error" ? "alert" : "status"}
    >
      <Icon className={cn("size-5 shrink-0", status.status === "syncing" && "animate-spin")} aria-hidden="true" />
      <span className="min-w-0 flex-1">{status.message}</span>
      {status.status !== "syncing" ? (
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-current/20 opacity-80 transition hover:opacity-100 focus:outline-none focus:ring-4 focus:ring-current/20"
          onClick={() => setStatus(null)}
          aria-label="Fechar aviso de sincronizacao"
        >
          x
        </button>
      ) : null}
    </div>
  );
}
