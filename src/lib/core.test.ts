import { describe, expect, it } from "vitest";
import { parsePositiveNtd } from "@/lib/money";
import {
  buildMonthlyEvents,
  calculateMonthSummary,
  getEventsForDate,
} from "@/lib/recurrence";
import {
  CASH_RECORDS_BACKUP_PREFIX,
  CASH_RECORDS_KEY,
  CASH_RECORDS_QUARANTINE_KEY,
  loadCashRecords,
} from "@/lib/storage";
import type { CashRecord } from "@/types/cash-record";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  keys() {
    return [...this.values.keys()];
  }
}

function record(overrides: Partial<CashRecord> = {}): CashRecord {
  return {
    id: "record-1",
    title: "測試",
    amount: 100,
    recordType: "expense",
    frequency: "monthly",
    date: "2026-01-01",
    dayOfMonth: "1",
    dayOfWeek: "星期一",
    monthOfYear: "1",
    category: "其他",
    createdAt: "2026-01-01T00:00:00.000Z",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    ...overrides,
  };
}

function legacyRecord(overrides: Record<string, unknown> = {}) {
  const legacy: Record<string, unknown> = { ...record() };
  delete legacy.effectiveFrom;
  delete legacy.effectiveTo;
  return { ...legacy, ...overrides };
}

describe("storage migration and isolation", () => {
  it("migrates a legacy CashRecord array and preserves every valid record", () => {
    const storage = new MemoryStorage();
    storage.setItem(CASH_RECORDS_KEY, JSON.stringify([legacyRecord()]));

    const result = loadCashRecords(storage);
    const saved = JSON.parse(storage.getItem(CASH_RECORDS_KEY) ?? "");

    expect(result.records).toHaveLength(1);
    expect(result.records[0].effectiveFrom).toBe("0001-01-01");
    expect(result.records[0].effectiveTo).toBeNull();
    expect(saved.version).toBe(2);
    expect(saved.records).toHaveLength(1);
    expect(
      storage.keys().some((key) => key.startsWith(CASH_RECORDS_BACKUP_PREFIX))
    ).toBe(true);
  });

  it("backs up malformed JSON and returns an empty usable result", () => {
    const storage = new MemoryStorage();
    storage.setItem(CASH_RECORDS_KEY, "{broken");

    expect(() => loadCashRecords(storage)).not.toThrow();
    const result = loadCashRecords(storage);
    expect(result.records).toEqual([]);
    expect(storage.getItem(CASH_RECORDS_QUARANTINE_KEY)).not.toBeNull();
    expect(
      storage.keys().some((key) => key.startsWith(CASH_RECORDS_BACKUP_PREFIX))
    ).toBe(true);
  });

  it("keeps valid records and quarantines invalid records", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CASH_RECORDS_KEY,
      JSON.stringify([legacyRecord(), legacyRecord({ id: "bad", amount: 1.5 })])
    );

    const result = loadCashRecords(storage);
    expect(result.records.map((item) => item.id)).toEqual(["record-1"]);
    expect(result.quarantined).toHaveLength(1);
    expect(storage.getItem(CASH_RECORDS_QUARANTINE_KEY)).toContain('"id":"bad"');
  });
});

describe("recurrence", () => {
  it("does not generate a recurring record before effectiveFrom", () => {
    const item = record({ effectiveFrom: "2026-06-15", dayOfMonth: "10" });
    expect(buildMonthlyEvents([item], new Date(2026, 4, 1))).toHaveLength(0);
    expect(buildMonthlyEvents([item], new Date(2026, 5, 1))).toHaveLength(0);
    expect(buildMonthlyEvents([item], new Date(2026, 6, 1))).toHaveLength(1);
  });

  it("uses rule versions without rewriting historical months", () => {
    const oldRule = record({
      id: "old",
      amount: 100,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-05-14",
      dayOfMonth: "10",
    });
    const newRule = record({
      id: "new",
      amount: 250,
      effectiveFrom: "2026-05-15",
      dayOfMonth: "10",
    });

    expect(calculateMonthSummary([oldRule, newRule], new Date(2026, 3, 1)).fixedExpense).toBe(100);
    expect(calculateMonthSummary([oldRule, newRule], new Date(2026, 5, 1)).fixedExpense).toBe(250);
  });

  it("moves monthly day 31 to the final day of a short month", () => {
    const events = buildMonthlyEvents(
      [record({ dayOfMonth: "31" })],
      new Date(2026, 1, 1)
    );
    expect(events[0].dateText).toBe("2026-02-28");
  });

  it("moves yearly February 29 to February 28 in a non-leap year", () => {
    const events = buildMonthlyEvents(
      [
        record({
          frequency: "yearly",
          monthOfYear: "2",
          dayOfMonth: "29",
          effectiveFrom: "2020-01-01",
        }),
      ],
      new Date(2025, 1, 1)
    );
    expect(events[0].dateText).toBe("2025-02-28");
  });

  it("generates the correct weekly occurrence count in different months", () => {
    const weekly = record({
      frequency: "weekly",
      dayOfWeek: "星期四",
    });
    expect(buildMonthlyEvents([weekly], new Date(2026, 0, 1))).toHaveLength(5);
    expect(buildMonthlyEvents([weekly], new Date(2026, 1, 1))).toHaveLength(4);
  });

  it("produces the same month totals from summary and calendar dates", () => {
    const records = [
      record({ id: "expense", amount: 300, dayOfMonth: "31" }),
      record({
        id: "income",
        recordType: "income",
        amount: 1000,
        dayOfMonth: "5",
      }),
    ];
    const month = new Date(2026, 3, 1);
    const summary = calculateMonthSummary(records, month);
    const calendarEvents = Array.from({ length: 30 }, (_, index) =>
      getEventsForDate(records, new Date(2026, 3, index + 1))
    ).flat();

    expect(calendarEvents).toEqual(summary.events);
    expect(summary.balance).toBe(700);
  });
});

describe("NTD amounts", () => {
  it.each([
    "1.5",
    "Infinity",
    "NaN",
    "1e3",
    String(Number.MAX_SAFE_INTEGER + 1),
  ])("rejects invalid amount %s", (value) => {
    expect(parsePositiveNtd(value)).toBeNull();
  });

  it("accepts a safe positive integer", () => {
    expect(parsePositiveNtd("123456")).toBe(123456);
  });
});
