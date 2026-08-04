import type { CategorySettings, ExpenseCategory } from "@/types/settings";
import { CATEGORY_SETTINGS_VERSION } from "@/types/settings";

export const SYSTEM_EXPENSE_CATEGORIES = [
  { id: "system-food", name: "餐飲" },
  { id: "system-transport", name: "交通" },
  { id: "system-housing", name: "居住" },
  { id: "system-shopping", name: "購物" },
  { id: "system-entertainment", name: "娛樂" },
  { id: "system-health", name: "醫療" },
  { id: "system-education", name: "教育" },
  { id: "system-other", name: "其他" },
] as const;

export function createDefaultCategorySettings(): CategorySettings {
  return {
    version: CATEGORY_SETTINGS_VERSION,
    categories: SYSTEM_EXPENSE_CATEGORIES.map(
      (category): ExpenseCategory => ({
        ...category,
        isSystem: true,
        disabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      })
    ),
    lastUsedExpenseCategoryId: null,
  };
}

export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function hasCategoryName(
  settings: CategorySettings,
  name: string,
  exceptId?: string
) {
  const normalized = normalizeCategoryName(name).toLocaleLowerCase("zh-TW");
  return settings.categories.some(
    (category) =>
      category.id !== exceptId &&
      category.name.toLocaleLowerCase("zh-TW") === normalized
  );
}

export function addCustomCategory(
  settings: CategorySettings,
  name: string,
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString()
): CategorySettings {
  const normalized = normalizeCategoryName(name);
  if (!normalized) throw new Error("分類名稱不可空白");
  if (hasCategoryName(settings, normalized)) throw new Error("分類名稱不可重複");

  return {
    ...settings,
    categories: [
      ...settings.categories,
      { id, name: normalized, isSystem: false, disabled: false, createdAt },
    ],
  };
}

export function renameCustomCategory(
  settings: CategorySettings,
  id: string,
  name: string
): CategorySettings {
  const target = settings.categories.find((category) => category.id === id);
  if (!target || target.isSystem) throw new Error("只能重新命名自訂分類");
  const normalized = normalizeCategoryName(name);
  if (!normalized) throw new Error("分類名稱不可空白");
  if (hasCategoryName(settings, normalized, id)) throw new Error("分類名稱不可重複");
  return {
    ...settings,
    categories: settings.categories.map((category) =>
      category.id === id ? { ...category, name: normalized } : category
    ),
  };
}

export function setCategoryDisabled(
  settings: CategorySettings,
  id: string,
  disabled: boolean
): CategorySettings {
  if (!settings.categories.some((category) => category.id === id)) {
    throw new Error("找不到分類");
  }
  return {
    ...settings,
    categories: settings.categories.map((category) =>
      category.id === id ? { ...category, disabled } : category
    ),
    lastUsedExpenseCategoryId:
      disabled && settings.lastUsedExpenseCategoryId === id
        ? null
        : settings.lastUsedExpenseCategoryId,
  };
}

export function getActiveCategories(settings: CategorySettings) {
  return settings.categories.filter((category) => !category.disabled);
}

export function getCategoryIcon(category: string) {
  const icons: Record<string, string> = {
    餐飲: "🍱",
    交通: "🚌",
    居住: "🏠",
    購物: "🛍️",
    娛樂: "🎮",
    醫療: "🩺",
    教育: "📚",
    其他: "🧾",
  };
  return icons[category] ?? "🏷️";
}
