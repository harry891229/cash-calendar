"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { startFlashToast } from "@/lib/flash-message";

type VisibleToast = { message: string; pathname: string };

export default function FlashToast() {
  const [toast, setToast] = useState<VisibleToast | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    return startFlashToast((message) => {
      setToast(message ? { message, pathname } : null);
    });
  }, [pathname]);

  // Hide the previous page's message immediately, before effect cleanup runs.
  if (!toast || toast.pathname !== pathname) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-5 z-[9999] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-2xl"
    >
      {toast.message}
    </div>
  );
}
