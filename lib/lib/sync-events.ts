export const SYNC_STATUS_EVENT = "maya:sync-status";

export type SyncStatusEventDetail = {
  status: "syncing" | "online" | "error";
  message: string;
};

export function emitSyncStatus(detail: SyncStatusEventDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<SyncStatusEventDetail>(SYNC_STATUS_EVENT, { detail }));
}
