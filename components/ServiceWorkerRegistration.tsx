"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register the service worker if available
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("Service worker registered.", reg);
      });
    }

    // Minimal manual sync example:
    async function doSync() {
      try {
        // In a real app, you'd gather local changes from your Drizzle DB or some change log.
        const localChanges = { example: "some local changes" };

        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localChanges),
        });

        const result = await response.json();
        console.log("Sync result:", result);
      } catch (err) {
        console.error("Sync error:", err);
      }
    }

    // Attempt sync on mount (and only once). You could do more sophisticated logic (e.g. intervals, network callbacks).
    if (navigator.onLine) {
      doSync();
    }
  }, []);

  return null;
}
