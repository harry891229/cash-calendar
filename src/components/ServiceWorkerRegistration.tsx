"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      const cleanupDevelopmentWorker = async () => {
        try {
          const wasControlled = navigator.serviceWorker.controller !== null;
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map((registration) => registration.unregister())
          );

          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames
                .filter((name) => name.startsWith("cash-calendar-"))
                .map((name) => caches.delete(name))
            );
          }

          const reloadKey = "cashCalendarDevSwCleanupReloaded";
          if (wasControlled && !sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, "1");
            window.location.reload();
            return;
          }

          sessionStorage.removeItem(reloadKey);
        } catch {
          // Development cleanup is best-effort and must not break the app.
        }
      };

      void cleanupDevelopmentWorker();
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // PWA support is progressive enhancement; registration failure must not
        // prevent the accounting app from continuing as a normal website.
      });
    };

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
