"use client";

import { useEffect, useState } from "react";
import {
  shouldShowInstallButton,
  shouldShowInstallInstructions,
} from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallGuide() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() =>
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true))
  );

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (isStandalone) {
    return <p className="rounded-2xl bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">目前已以 App 模式開啟</p>;
  }

  return (
    <div className="space-y-3">
      {shouldShowInstallButton({ isStandalone, hasNativePrompt: installPrompt !== null }) ? (
        <button type="button" onClick={() => void install()} className="w-full rounded-2xl bg-sky-400 px-4 py-3 font-black text-slate-950">
          安裝 App
        </button>
      ) : null}
      {shouldShowInstallInstructions(isStandalone) ? (
        <ul className="space-y-2 text-sm text-slate-300">
          <li><strong>Android Chrome：</strong>瀏覽器選單 → 安裝應用程式</li>
          <li><strong>Windows Edge／Chrome：</strong>點選網址列右側的安裝圖示</li>
          <li><strong>iPhone／iPad Safari：</strong>分享 → 加入主畫面</li>
        </ul>
      ) : null}
    </div>
  );
}
