import { isSameMonth, toDateText } from "@/lib/date";
import { sumSignedAmounts } from "@/lib/money";
import { calculateCategorySpending, getEventsForDate } from "@/lib/recurrence";
import type { CashRecord } from "@/types/cash-record";

export type CalendarView = {
  month: Date;
  selectedDateText: string | null;
  expandedCategory: string | null;
};

export type CalendarViewAction =
  | { type: "selectDate"; dateText: string }
  | { type: "monthCategories" }
  | { type: "shiftMonth"; offset: number }
  | { type: "toggleCategory"; category: string };

export function createCalendarView(today = new Date()): CalendarView {
  return {
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    selectedDateText: null,
    expandedCategory: null,
  };
}

export function calendarViewReducer(state: CalendarView, action: CalendarViewAction): CalendarView {
  switch (action.type) {
    case "selectDate":
      return isSameMonth(action.dateText, state.month)
        ? { ...state, selectedDateText: action.dateText, expandedCategory: null }
        : state;
    case "monthCategories":
      return { ...state, selectedDateText: null, expandedCategory: null };
    case "shiftMonth":
      return createCalendarView(new Date(state.month.getFullYear(), state.month.getMonth() + action.offset, 1));
    case "toggleCategory":
      return { ...state, expandedCategory: state.expandedCategory === action.category ? null : action.category };
  }
}

export function getCalendarDetails(records: CashRecord[], view: CalendarView) {
  if (view.selectedDateText === null) {
    return { mode: "month" as const, categories: calculateCategorySpending(records, view.month) };
  }
  const day = Number(view.selectedDateText.slice(-2));
  const date = new Date(view.month.getFullYear(), view.month.getMonth(), day);
  const events = getEventsForDate(records, date);
  return { mode: "day" as const, dateText: toDateText(date), events, total: sumSignedAmounts(events) };
}
