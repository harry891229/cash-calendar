import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_INFO, APP_VERSION } from "@/lib/app-info";
import {
  shouldRequestWorkerActivation,
  shouldShowInstallButton,
  shouldShowInstallInstructions,
  shouldShowUpdatePrompt,
} from "@/lib/pwa";
import { previewCashRecordsImport } from "@/lib/storage";

describe("central app release information", () => {
  it("exposes the v5 production version from one module", () => {
    expect(APP_INFO).toMatchObject({
      name: "記帳月曆",
      shortName: "記帳",
      version: "v5.0.0",
      releaseStage: "production",
    });
    expect(APP_VERSION).toBe(APP_INFO.version);
  });
});

describe("backup appVersion compatibility", () => {
  it("keeps appVersion optional when importing an old backup", () => {
    const result = previewCashRecordsImport(JSON.stringify({ version: 2, records: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.appVersion).toBeNull();
  });

  it("reads appVersion when a new backup contains it", () => {
    const result = previewCashRecordsImport(JSON.stringify({ version: 2, appVersion: "v5.0.0", records: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.appVersion).toBe("v5.0.0");
  });
});

describe("PWA update and installation decisions", () => {
  it("shows a waiting worker update message only once", () => {
    expect(shouldShowUpdatePrompt(true, false)).toBe(true);
    expect(shouldShowUpdatePrompt(true, true)).toBe(false);
  });

  it("requests worker activation only after user confirmation", () => {
    expect(shouldRequestWorkerActivation(false)).toBe(false);
    expect(shouldRequestWorkerActivation(true)).toBe(true);
  });

  it("does not show the install button in standalone mode", () => {
    expect(shouldShowInstallButton({ isStandalone: true, hasNativePrompt: true })).toBe(false);
  });

  it("still shows platform instructions without beforeinstallprompt", () => {
    expect(shouldShowInstallButton({ isStandalone: false, hasNativePrompt: false })).toBe(false);
    expect(shouldShowInstallInstructions(false)).toBe(true);
  });
});

describe("release safety copy", () => {
  it("contains the localhost to production migration warning", () => {
    const settingsSource = readFileSync(new URL("../app/settings/page.tsx", import.meta.url), "utf8");
    expect(settingsSource).toContain("localhost 與正式 HTTPS 網址是不同的儲存空間");
    expect(settingsSource).toContain("下載 JSON 備份");
    expect(settingsSource).toContain("匯入該備份");
  });

  it("does not let the global error page touch localStorage", () => {
    const errorSource = readFileSync(new URL("../app/global-error.tsx", import.meta.url), "utf8");
    expect(errorSource).not.toContain("localStorage");
    expect(errorSource).toContain("不會清除或改寫本機資料");
  });
});
