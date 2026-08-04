import { describe, expect, it } from "vitest";
import { buildMonthlyEvents } from "@/lib/recurrence";
import {
  permanentlyDeleteRecurringVersion,
  stopRecurringRule,
} from "@/lib/recurring-rules";
import type { CashRecord } from "@/types/cash-record";

function recurring(overrides: Partial<CashRecord> = {}): CashRecord {
  return {
    id: "salary-rule",
    title: "薪水",
    amount: 40000,
    recordType: "income",
    frequency: "monthly",
    date: "2026-01-01",
    dayOfMonth: "5",
    dayOfWeek: "星期一",
    monthOfYear: "1",
    category: "其他",
    createdAt: "2026-01-01T00:00:00.000Z",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    ...overrides,
  };
}

describe("recurring rule management", () => {
  it("stops a rule while preserving history", () => {
    const stopped = stopRecurringRule([recurring()], "salary-rule", new Date(2026, 4, 15));
    expect(stopped[0].effectiveTo).toBe("2026-05-15");
    expect(buildMonthlyEvents(stopped, new Date(2026, 3, 1))).toHaveLength(1);
    expect(buildMonthlyEvents(stopped, new Date(2026, 5, 1))).toHaveLength(0);
  });

  it("removes both historical and future displays after permanent deletion", () => {
    const deleted = permanentlyDeleteRecurringVersion(
      [recurring()],
      "salary-rule",
      true
    );
    expect(buildMonthlyEvents(deleted, new Date(2026, 0, 1))).toHaveLength(0);
    expect(buildMonthlyEvents(deleted, new Date(2026, 11, 1))).toHaveLength(0);
  });

  it("does not delete other rules", () => {
    const other = recurring({ id: "rent-rule", title: "房租", recordType: "expense", amount: 12000 });
    const deleted = permanentlyDeleteRecurringVersion(
      [recurring(), other],
      "salary-rule",
      true
    );
    expect(deleted).toEqual([other]);
  });

  it("leaves records unchanged when either confirmation is cancelled", () => {
    const records = [recurring()];
    expect(
      permanentlyDeleteRecurringVersion(records, "salary-rule", false)
    ).toBe(records);
  });
});
