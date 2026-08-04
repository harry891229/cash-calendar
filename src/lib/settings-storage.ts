import { createDefaultCategorySettings } from "@/lib/categories";
import { isPositiveNtd } from "@/lib/money";
import {
  BUDGET_SETTINGS_VERSION,
  CATEGORY_SETTINGS_VERSION,
  type BudgetSettings,
  type CategorySettings,
  type ExpenseCategory,
} from "@/types/settings";

export const BUDGET_SETTINGS_KEY = "cashCalendarBudgetSettings";
export const CATEGORY_SETTINGS_KEY = "cashCalendarCategorySettings";
export const SETTINGS_BACKUP_PREFIX = "cashCalendarSettingsBackupV1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type SafeSettingsResult<T> = { value: T; recovered: boolean; backupKey: string | null };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function backupInvalid(storage: StorageLike, key: string, raw: string) {
  const backupKey = `${SETTINGS_BACKUP_PREFIX}:${key}:${new Date().toISOString()}`;
  storage.setItem(backupKey, raw);
  return backupKey;
}

export function createDefaultBudgetSettings(): BudgetSettings {
  return { version: BUDGET_SETTINGS_VERSION, monthlyBudget: null };
}

export function isBudgetSettings(value: unknown): value is BudgetSettings {
  return (
    isObject(value) &&
    value.version === BUDGET_SETTINGS_VERSION &&
    (value.monthlyBudget === null || isPositiveNtd(value.monthlyBudget))
  );
}

function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return (
    isObject(value) &&
    typeof value.id === "string" && value.id.length > 0 &&
    typeof value.name === "string" && value.name.trim().length > 0 &&
    typeof value.isSystem === "boolean" &&
    typeof value.disabled === "boolean" &&
    typeof value.createdAt === "string"
  );
}

export function isCategorySettings(value: unknown): value is CategorySettings {
  if (
    !isObject(value) ||
    value.version !== CATEGORY_SETTINGS_VERSION ||
    !Array.isArray(value.categories) ||
    !(value.lastUsedExpenseCategoryId === null || typeof value.lastUsedExpenseCategoryId === "string")
  ) return false;

  if (!value.categories.every(isExpenseCategory)) return false;
  const ids = value.categories.map((category) => category.id);
  const names = value.categories.map((category) => category.name.trim().toLocaleLowerCase("zh-TW"));
  return new Set(ids).size === ids.length && new Set(names).size === names.length;
}

function loadSafe<T>(
  storage: StorageLike,
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T
): SafeSettingsResult<T> {
  const raw = storage.getItem(key);
  if (raw === null) return { value: fallback, recovered: false, backupKey: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validate(parsed)) return { value: parsed, recovered: false, backupKey: null };
  } catch {
    // Invalid raw data is backed up below before a safe default is restored.
  }
  const backupKey = backupInvalid(storage, key, raw);
  storage.setItem(key, JSON.stringify(fallback));
  return { value: fallback, recovered: true, backupKey };
}

export function loadBudgetSettings(storage: StorageLike = localStorage) {
  return loadSafe(storage, BUDGET_SETTINGS_KEY, createDefaultBudgetSettings(), isBudgetSettings);
}

export function saveBudgetSettings(value: BudgetSettings, storage: StorageLike = localStorage) {
  if (!isBudgetSettings(value)) throw new Error("預算設定格式不合法");
  storage.setItem(BUDGET_SETTINGS_KEY, JSON.stringify(value));
}

export function loadCategorySettings(storage: StorageLike = localStorage) {
  return loadSafe(storage, CATEGORY_SETTINGS_KEY, createDefaultCategorySettings(), isCategorySettings);
}

export function saveCategorySettings(value: CategorySettings, storage: StorageLike = localStorage) {
  if (!isCategorySettings(value)) throw new Error("分類設定格式不合法");
  storage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(value));
}

export function backupCurrentSettings(storage: StorageLike = localStorage) {
  const backupKey = `${SETTINGS_BACKUP_PREFIX}:import:${new Date().toISOString()}`;
  storage.setItem(
    backupKey,
    JSON.stringify({
      budgetSettings: storage.getItem(BUDGET_SETTINGS_KEY),
      categorySettings: storage.getItem(CATEGORY_SETTINGS_KEY),
    })
  );
  return backupKey;
}
