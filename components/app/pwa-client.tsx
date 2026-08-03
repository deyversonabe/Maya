"use client";

import { useEffect } from "react";

export function PwaClient() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("maya_service_worker_registration_failed", error);
    });
  }, []);

  return null;
}
