import { useEffect } from "react";

export function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then(() => console.log("[SW] Registered"))
        .catch((err) => console.error("[SW] Registration failed:", err));
    }
  }, []);
}
