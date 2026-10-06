import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SettingsPage from "@/app/settings/page";
import {
  getSettingsSectionTitle,
  SETTINGS_DIRECTORY,
} from "@/lib/settings-sections";

vi.mock("@/components/BottomNav", () => ({ default: () => null }));

describe("settings directory", () => {
  it("groups the existing features into three entry-point lists", () => {
    expect(SETTINGS_DIRECTORY.map((group) => group.title)).toEqual([
      "記帳設定",
      "資料管理",
      "關於",
    ]);
    expect(SETTINGS_DIRECTORY.map((group) =>
      group.entries.map((entry) => entry.id)
    )).toEqual([
      ["budget", "categories", "recurring"],
      ["backup", "data"],
      ["about"],
    ]);
    expect(getSettingsSectionTitle(null)).toBe("設定");
    expect(getSettingsSectionTitle("recurring")).toBe("固定收支");
    expect(getSettingsSectionTitle("data")).toBe("資料管理");
  });

  it("initially renders only the directory, keeping infrequent and dangerous controls in the second layer", () => {
    const markup = renderToStaticMarkup(createElement(SettingsPage));
    expect(markup.match(/<section/g)).toHaveLength(3);
    expect(markup.match(/<button/g)).toHaveLength(6);
    for (const title of ["每月預算", "分類管理", "固定收支", "備份與還原", "App 資訊"]) {
      expect(markup).toContain(title);
    }
    expect(markup).not.toContain("下載備份檔");
    expect(markup).not.toContain('type="file"');
    expect(markup).not.toContain("清除全部記帳資料");
    expect(markup).not.toContain("永久刪除");
  });

  it("preserves the single permanent-delete dialog with only cancel and delete actions", () => {
    const source = readFileSync(
      new URL("../app/settings/page.tsx", import.meta.url),
      "utf8"
    );
    const dialog = source.slice(
      source.indexOf("{deleteCandidate ? ("),
      source.indexOf("<BottomNav />")
    );
    expect(dialog.match(/<button/g)).toHaveLength(2);
    expect(dialog).toContain(">取消</button>");
    expect(dialog).toContain(">永久刪除</button>");
    expect(dialog).not.toContain("我了解，繼續");
    expect(dialog).not.toContain("<input");
  });

  it("keeps category and recurring operations inside their selected detail views", () => {
    const source = readFileSync(
      new URL("../app/settings/page.tsx", import.meta.url),
      "utf8"
    );
    const categories = source.slice(
      source.indexOf('{activeSection === "categories"'),
      source.indexOf('{activeSection === "recurring"')
    );
    const recurring = source.slice(
      source.indexOf('{activeSection === "recurring"'),
      source.indexOf('{activeSection === "backup"')
    );
    expect(categories).toContain("addCategory");
    expect(categories).toContain("saveRename");
    expect(categories).toContain("toggleCategory");
    expect(categories).toContain("歷史紀錄仍保留原分類名稱");
    expect(recurring).toContain("stopRecurring");
    expect(recurring).toContain("openPermanentDelete");
    expect(recurring).toContain('href={`/add?editId=${record.id}`}');
    expect(source).toContain("返回設定");
  });
});
