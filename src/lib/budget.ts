import { getDaysInMonth } from "@/lib/date";
import { calculateMonthSummary } from "@/lib/recurrence";
import type { CashRecord } from "@/types/cash-record";

export function getRemainingDaysInMonth(date: Date) {
  return getDaysInMonth(date.getFullYear(), date.getMonth()) - date.getDate() + 1;
}

export function calculateBudgetStatus(
  records: CashRecord[],
  date: Date,
  monthlyBudget: number | null
) {
  const totalExpense = calculateMonthSummary(records, date).totalExpense;
  const remainingDays = getRemainingDaysInMonth(date);
  if (monthlyBudget === null) {
    return {
      monthlyBudget: null,
      totalExpense,
      remainingBudget: null,
      usagePercent: null,
      remainingDays,
      dailyAvailable: null,
      isOverBudget: false,
    };
  }
  const remainingBudget = monthlyBudget - totalExpense;
  return {
    monthlyBudget,
    totalExpense,
    remainingBudget,
    usagePercent: Math.round((totalExpense / monthlyBudget) * 100),
    remainingDays,
    dailyAvailable: Math.floor(Math.max(remainingBudget, 0) / remainingDays),
    isOverBudget: remainingBudget < 0,
  };
}
