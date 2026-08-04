import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createDefaultSettingsSectionState,
  toggleSettingsSection,
} from "@/lib/settings-sections";

describe("settings collapsible sections", () => {
  it("starts category and recurring management collapsed", () => {
    expect(createDefaultSettingsSectionState()).toEqual({
      categories: false,
      recurring: false,
    });
  });

  it("toggles each section without touching unrelated data", () => {
    const records = [{ id: "record-1" }];
    const initial = createDefaultSettingsSectionState();
    const categoriesOpen = toggleSettingsSection(initial, "categories");
    const recurringOpen = toggleSettingsSection(categoriesOpen, "recurring");
    expect(categoriesOpen).toEqual({ categories: true, recurring: false });
    expect(recurringOpen).toEqual({ categories: true, recurring: true });
    expect(records).toEqual([{ id: "record-1" }]);
  });

  it("renders a single permanent-delete dialog with only cancel and delete actions", () => {
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

  it("keeps category and recurring operations inside expandable content", () => {
    const source = readFileSync(
      new URL("../app/settings/page.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("addCategory");
    expect(source).toContain("saveRename");
    expect(source).toContain("toggleCategory");
    expect(source).toContain("stopRecurring");
    expect(source).toContain("openPermanentDelete");
    expect(source).toContain("aria-expanded={isExpanded}");
  });
});
