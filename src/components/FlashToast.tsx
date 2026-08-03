"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { consumeFlashMessage } from "@/lib/flash-message";

export default function FlashToast() {
  const [message, setMessage] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    const savedMessage = consumeFlashMessage();
    if (!savedMessage) return;

    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      setMessage(savedMessage);
      hideTimer = window.setTimeout(() => setMessage(""), 2500);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [pathname]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-5 z-[9999] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-2xl"
    >
      {message}
    </div>
  );
}
