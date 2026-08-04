export const BUDGET_SETTINGS_VERSION = 1 as const;
export const CATEGORY_SETTINGS_VERSION = 1 as const;

export type BudgetSettings = {
  version: typeof BUDGET_SETTINGS_VERSION;
  monthlyBudget: number | null;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  isSystem: boolean;
  disabled: boolean;
  createdAt: string;
};

export type CategorySettings = {
  version: typeof CATEGORY_SETTINGS_VERSION;
  categories: ExpenseCategory[];
  lastUsedExpenseCategoryId: string | null;
};
