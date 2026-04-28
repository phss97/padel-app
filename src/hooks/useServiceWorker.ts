import { useEffect } from "react";

export function useServiceWorker() {
  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((r) => {
          registration = r;
          console.log("[SW] Registered");
        })
        .catch((err) => console.error("[SW] Registration failed:", err));
    }
    return () => {
      registration?.unregister();
    };
  }, []);
}
