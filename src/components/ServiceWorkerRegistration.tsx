"use client";

import { useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/app-info";
import {
  shouldReloadForControllerChange,
  shouldRequestWorkerActivation,
  shouldShowUpdatePrompt,
} from "@/lib/pwa";

export default function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const promptShownRef = useRef(false);
  const updateRequestedRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      const cleanupDevelopmentWorker = async () => {
        try {
          const wasControlled = navigator.serviceWorker.controller !== null;
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
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
          // PWA cleanup is best-effort and must never break development.
        }
      };
      void cleanupDevelopmentWorker();
      return;
    }

    const reloadKey = `cashCalendarSwReload:${APP_VERSION}`;
    const controllerChanged = () => {
      const alreadyRequested = sessionStorage.getItem(reloadKey) === "1";
      if (
        shouldReloadForControllerChange(
          updateRequestedRef.current,
          alreadyRequested
        )
      ) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);

    const exposeWaitingWorker = (worker: ServiceWorker | null) => {
      if (worker && shouldShowUpdatePrompt(true, promptShownRef.current)) {
        promptShownRef.current = true;
        setWaitingWorker(worker);
      }
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        exposeWaitingWorker(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              exposeWaitingWorker(registration.waiting ?? installing);
            }
          });
        });
        await registration.update();
      } catch {
        // PWA is progressive enhancement; the web app remains usable.
      }
    };

    window.addEventListener("load", register, { once: true });
    const clearReloadMarker = window.setTimeout(() => sessionStorage.removeItem(reloadKey), 3000);
    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      window.clearTimeout(clearReloadMarker);
    };
  }, []);

  function updateNow() {
    if (!waitingWorker || !shouldRequestWorkerActivation(true)) return;
    updateRequestedRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
  }

  if (!waitingWorker) return null;

  return (
    <aside role="status" className="fixed inset-x-4 bottom-24 z-[9998] mx-auto max-w-md rounded-3xl bg-slate-800 p-4 text-white shadow-2xl ring-1 ring-sky-300/40">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-black">有新版本可用</p>
          <p className="mt-1 text-xs text-slate-300">完成目前輸入後，可由你決定何時更新。</p>
        </div>
        <button type="button" onClick={updateNow} className="shrink-0 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950">立即更新</button>
      </div>
    </aside>
  );
}
