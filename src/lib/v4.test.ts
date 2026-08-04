import { describe, expect, it } from "vitest";
import { calculateBudgetStatus, getRemainingDaysInMonth } from "@/lib/budget";
import {
  addCustomCategory,
  createDefaultCategorySettings,
  getActiveCategories,
  renameCustomCategory,
  setCategoryDisabled,
} from "@/lib/categories";
import { createCashCalendarBackup } from "@/lib/backup";
import {
  BUDGET_SETTINGS_KEY,
  CATEGORY_SETTINGS_KEY,
  SETTINGS_BACKUP_PREFIX,
  createDefaultBudgetSettings,
  loadBudgetSettings,
  loadCategorySettings,
} from "@/lib/settings-storage";
import { previewCashRecordsImport, restoreCashRecordsFromText } from "@/lib/storage";
import { createSubmissionGuard } from "@/lib/submission-guard";
import type { CashRecord } from "@/types/cash-record";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  keys() { return [...this.values.keys()]; }
}

function record(overrides: Partial<CashRecord> = {}): CashRecord {
  return {
    id: "record-1",
    title: "支出",
    amount: 1000,
    recordType: "expense",
    frequency: "once",
    date: "2026-08-03",
    dayOfMonth: "3",
    dayOfWeek: "星期一",
    monthOfYear: "8",
    category: "餐飲",
    createdAt: "2026-08-03T00:00:00.000Z",
    effectiveFrom: "2026-08-03",
    effectiveTo: null,
    ...overrides,
  };
}

describe("monthly budget", () => {
  it("does not calculate budget values when budget is unset", () => {
    const result = calculateBudgetStatus([record()], new Date(2026, 7, 3), null);
    expect(result.remainingBudget).toBeNull();
    expect(result.dailyAvailable).toBeNull();
    expect(result.totalExpense).toBe(1000);
  });

  it("calculates remaining budget", () => {
    const result = calculateBudgetStatus([record()], new Date(2026, 7, 3), 5000);
    expect(result.remainingBudget).toBe(4000);
    expect(result.usagePercent).toBe(20);
  });

  it("shows zero daily availability when over budget", () => {
    expect(calculateBudgetStatus([record({ amount: 6000 })], new Date(2026, 7, 3), 5000).dailyAvailable).toBe(0);
  });

  it("counts the last day of a month as one remaining day", () => {
    expect(getRemainingDaysInMonth(new Date(2026, 7, 31))).toBe(1);
  });

  it("includes recurring and one-time expenses but not income", () => {
    const records = [
      record({ id: "once", amount: 500 }),
      record({ id: "fixed", amount: 1000, frequency: "monthly", dayOfMonth: "5", effectiveFrom: "2026-01-01" }),
      record({ id: "income", amount: 9999, recordType: "income" }),
    ];
    expect(calculateBudgetStatus(records, new Date(2026, 7, 3), 5000).totalExpense).toBe(1500);
  });
});

describe("category settings", () => {
  it("rejects duplicate names", () => {
    expect(() => addCustomCategory(createDefaultCategorySettings(), "餐飲", "custom")).toThrow("不可重複");
  });

  it("adds, renames and disables a custom category", () => {
    let settings = addCustomCategory(createDefaultCategorySettings(), "寵物", "pet", "2026-08-03T00:00:00.000Z");
    settings = renameCustomCategory(settings, "pet", "毛小孩");
    settings = setCategoryDisabled(settings, "pet", true);
    expect(settings.categories.find((item) => item.id === "pet")).toMatchObject({ name: "毛小孩", disabled: true });
  });

  it("keeps a disabled category value available to historical records", () => {
    const settings = setCategoryDisabled(createDefaultCategorySettings(), "system-food", true);
    expect(getActiveCategories(settings).some((item) => item.name === "餐飲")).toBe(false);
    expect(record().category).toBe("餐飲");
  });
});

describe("safe v4 settings and backups", () => {
  it("recovers from broken budget settings", () => {
    const storage = new MemoryStorage();
    storage.setItem(BUDGET_SETTINGS_KEY, "{broken");
    expect(loadBudgetSettings(storage)).toMatchObject({ value: { monthlyBudget: null }, recovered: true });
  });

  it("recovers from broken category settings", () => {
    const storage = new MemoryStorage();
    storage.setItem(CATEGORY_SETTINGS_KEY, "{broken");
    expect(loadCategorySettings(storage).recovered).toBe(true);
    expect(loadCategorySettings(storage).value.categories.length).toBeGreaterThan(0);
  });

  it("accepts an old v2/v3 backup without new settings fields", () => {
    const inspected = previewCashRecordsImport(JSON.stringify({ version: 2, records: [record()], exportedAt: "2026-08-03T00:00:00.000Z" }));
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.preview.includesBudget).toBe(false);
    expect(inspected.preview.budgetSettings.monthlyBudget).toBeNull();
  });

  it("creates a new backup with budget and category settings", () => {
    const budget = { ...createDefaultBudgetSettings(), monthlyBudget: 30000 };
    const categories = addCustomCategory(createDefaultCategorySettings(), "寵物", "pet", "2026-08-03T00:00:00.000Z");
    const backup = createCashCalendarBackup([record()], budget, categories, new Date("2026-08-03T00:00:00.000Z"));
    expect(backup.budgetSettings.monthlyBudget).toBe(30000);
    expect(backup.categorySettings.categories.some((item) => item.id === "pet")).toBe(true);
  });

  it("backs up current settings before a full import", () => {
    const storage = new MemoryStorage();
    storage.setItem(BUDGET_SETTINGS_KEY, JSON.stringify({ version: 1, monthlyBudget: 5000 }));
    const result = restoreCashRecordsFromText(JSON.stringify({ version: 2, records: [record()] }), storage);
    expect(result.ok).toBe(true);
    expect(storage.keys().some((key) => key.startsWith(`${SETTINGS_BACKUP_PREFIX}:import:`))).toBe(true);
  });
});

describe("submission guard", () => {
  it("allows only one save until explicitly unlocked", () => {
    const guard = createSubmissionGuard();
    expect(guard.tryLock()).toBe(true);
    expect(guard.tryLock()).toBe(false);
    guard.unlock();
    expect(guard.tryLock()).toBe(true);
  });
});
