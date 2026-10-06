import { describe, expect, it } from "vitest";
import { calendarViewReducer, createCalendarView, getCalendarDetails } from "@/lib/calendar-view";
import type { CashRecord } from "@/types/cash-record";

const records: CashRecord[] = [
  { id: "food", title: "午餐", amount: 150, recordType: "expense", frequency: "once", category: "餐飲", date: "2026-10-06", dayOfMonth: "6", dayOfWeek: "星期二", monthOfYear: "10", createdAt: "2026-10-06T00:00:00.000Z", effectiveFrom: "2026-10-06", effectiveTo: null },
  { id: "rent", title: "房租", amount: 10000, recordType: "expense", frequency: "monthly", category: "房租", date: "2026-09-01", dayOfMonth: "1", dayOfWeek: "星期二", monthOfYear: "9", createdAt: "2026-09-01T00:00:00.000Z", effectiveFrom: "2026-09-01", effectiveTo: null },
];

describe("calendar detail modes", () => {
  it("opens the current month with all expense categories", () => {
    const view = createCalendarView(new Date(2026, 9, 6));
    expect(view.selectedDateText).toBeNull();
    expect(getCalendarDetails(records, view)).toMatchObject({ mode: "month", categories: [{ category: "房租", total: 10000 }, { category: "餐飲", total: 150 }] });
  });

  it("shows only the selected day's records, then returns to the month", () => {
    const initial = createCalendarView(new Date(2026, 9, 6));
    const selected = calendarViewReducer(initial, { type: "selectDate", dateText: "2026-10-06" });
    expect(getCalendarDetails(records, selected)).toMatchObject({ mode: "day", dateText: "2026-10-06", total: -150, events: [{ title: "午餐" }] });
    const monthly = calendarViewReducer(selected, { type: "monthCategories" });
    expect(getCalendarDetails(records, monthly).mode).toBe("month");
    expect(monthly.month).toEqual(initial.month);
  });

  it("switches months from a selected date and resets to that month's categories", () => {
    const selected = calendarViewReducer(createCalendarView(new Date(2026, 9, 6)), { type: "selectDate", dateText: "2026-10-06" });
    const september = calendarViewReducer(selected, { type: "shiftMonth", offset: -1 });
    expect(september.selectedDateText).toBeNull();
    expect(getCalendarDetails(records, september)).toMatchObject({ mode: "month", categories: [{ category: "房租", total: 10000 }] });
    const october = calendarViewReducer(september, { type: "shiftMonth", offset: 1 });
    expect(getCalendarDetails(records, october)).toMatchObject({ mode: "month", categories: [{ category: "房租" }, { category: "餐飲" }] });
  });

  it("clears expanded category details after selecting a day or changing month", () => {
    const expanded = calendarViewReducer(createCalendarView(new Date(2026, 9, 6)), { type: "toggleCategory", category: "餐飲" });
    expect(expanded.expandedCategory).toBe("餐飲");
    expect(calendarViewReducer(expanded, { type: "selectDate", dateText: "2026-10-06" }).expandedCategory).toBeNull();
    expect(calendarViewReducer(expanded, { type: "shiftMonth", offset: 1 }).expandedCategory).toBeNull();
  });

  it("handles year boundaries and ignores dates outside the visible month", () => {
    const december = createCalendarView(new Date(2026, 11, 31));
    expect(calendarViewReducer(december, { type: "selectDate", dateText: "2026-11-30" })).toBe(december);
    const january = calendarViewReducer(december, { type: "shiftMonth", offset: 1 });
    expect(january.month.getFullYear()).toBe(2027);
    expect(january.month.getMonth()).toBe(0);
    expect(january.selectedDateText).toBeNull();
  });
});
