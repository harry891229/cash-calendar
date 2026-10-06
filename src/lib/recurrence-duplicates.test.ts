import { describe, expect, it, vi } from "vitest";
import { buildMonthlyEvents, calculateMonthSummary } from "@/lib/recurrence";
import {
  findRecurringDuplicateCandidates,
  replaceRecurringRuleVersion,
  stopRecurringRule,
} from "@/lib/recurring-rules";
import {
  CASH_RECORDS_BACKUP_PREFIX,
  CASH_RECORDS_KEY,
  CASH_RECORDS_QUARANTINE_KEY,
  getQuarantinedRecords,
  loadCashRecords,
  previewCashRecordsImport,
  resolveRecurringDuplicate,
  restoreCashRecordsFromText,
  restoreResolvedRecurringDuplicate,
  saveCashRecords,
} from "@/lib/storage";
import type { CashRecord } from "@/types/cash-record";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  keys() { return [...this.values.keys()]; }
}

function rule(overrides: Partial<CashRecord> = {}): CashRecord {
  return {
    id: "salary-original",
    title: "薪水",
    amount: 40000,
    recordType: "income",
    frequency: "monthly",
    date: "2026-01-01",
    dayOfMonth: "1",
    dayOfWeek: "星期一",
    monthOfYear: "1",
    category: "薪水",
    createdAt: "2026-01-01T00:00:00.000Z",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    ...overrides,
  };
}

function envelope(records: CashRecord[]) {
  return JSON.stringify({ version: 2, records });
}

function duplicatePair() {
  return [rule(), rule({
    id: "salary-duplicate",
    category: "舊分類",
    createdAt: "2026-09-01T00:00:00.000Z",
    effectiveFrom: "2026-09-01",
  })];
}

describe("fixed rule event duplication", () => {
  it("counts repeated identical salary and rent IDs only once", () => {
    const salary = rule();
    const rent = rule({ id: "rent", title: "房租", category: "房租", recordType: "expense", amount: 12000 });
    const summary = calculateMonthSummary([salary, { ...salary }, rent, { ...rent }], new Date(2026, 9, 6));
    expect(summary.events).toHaveLength(2);
    expect(summary.income).toBe(40000);
    expect(summary.fixedExpense).toBe(12000);
  });

  it("does not merge independent records with different IDs or altered fields", () => {
    const independent = rule({ id: "second-job" });
    expect(buildMonthlyEvents([rule(), independent], new Date(2026, 9, 1))).toHaveLength(2);
    expect(buildMonthlyEvents([rule(), rule({ category: "舊分類" })], new Date(2026, 9, 1))).toHaveLength(2);
  });

  it("does not merge separate one-time transactions with equal amounts", () => {
    const once = rule({ frequency: "once", date: "2026-10-01" });
    expect(buildMonthlyEvents([once, { ...once, id: "second-payment" }], new Date(2026, 9, 1))).toHaveLength(2);
  });
});

describe("safe recurring rule version replacement", () => {
  it("closes the previous version and preserves the original monthly history", () => {
    const original = rule();
    const replacement = rule({ id: "salary-new", amount: 45000, effectiveFrom: "2026-10-01" });
    const records = replaceRecurringRuleVersion([original], original.id, replacement, original);
    expect(records.find((record) => record.id === original.id)?.effectiveTo).toBe("2026-09-30");
    expect(calculateMonthSummary(records, new Date(2026, 8, 1)).income).toBe(40000);
    expect(calculateMonthSummary(records, new Date(2026, 9, 1)).income).toBe(45000);
    expect(original.effectiveTo).toBeNull();
  });

  it("rejects editing an old stopped version instead of extending it over a newer version", () => {
    const original = rule({ effectiveTo: "2026-09-30" });
    const current = rule({ id: "salary-current", effectiveFrom: "2026-10-01" });
    const records = [original, current];
    expect(() => replaceRecurringRuleVersion(records, original.id, rule({ id: "accidental-third", effectiveFrom: "2026-10-06" }))).toThrow("已停止");
    expect(buildMonthlyEvents(records, new Date(2026, 9, 1))).toHaveLength(1);
    expect(original.effectiveTo).toBe("2026-09-30");
  });

  it("rejects a stale edit loaded before the rule changed", () => {
    const original = rule();
    expect(() => replaceRecurringRuleVersion(
      [rule({ amount: 45000 })], original.id,
      rule({ id: "new", effectiveFrom: "2026-10-01" }), original
    )).toThrow("已被修改");
  });

  it("rejects replacement dates that could rewrite the start of history", () => {
    expect(() => replaceRecurringRuleVersion(
      [rule()], "salary-original", rule({ id: "new", effectiveFrom: "2026-01-01" })
    )).toThrow("必須晚於");
  });

  it("rejects a replacement ID already stored by another rule", () => {
    expect(() => replaceRecurringRuleVersion(
      [rule(), rule({ id: "occupied" })], "salary-original",
      rule({ id: "occupied", effectiveFrom: "2026-10-01" })
    )).toThrow("不同的 ID");
  });

  it("uses the transaction date as the boundary when converting a rule to once", () => {
    const records = replaceRecurringRuleVersion([rule()], "salary-original", rule({
      id: "once", frequency: "once", date: "2026-10-01", effectiveFrom: "2026-10-15",
    }));
    expect(records[0].effectiveFrom).toBe("2026-10-01");
    expect(records[1].effectiveTo).toBe("2026-09-30");
    expect(calculateMonthSummary(records, new Date(2026, 9, 1)).income).toBe(40000);
  });

  it("stopping a version again does not extend its historical end date", () => {
    const records = [rule({ effectiveTo: "2026-09-30" })];
    expect(stopRecurringRule(records, "salary-original", new Date(2026, 9, 6))).toBe(records);
    expect(records[0].effectiveTo).toBe("2026-09-30");
  });
});

describe("manual recurring duplication review", () => {
  it("finds a concrete overlapping occurrence even when categories differ", () => {
    expect(findRecurringDuplicateCandidates(duplicatePair())).toEqual([{
      original: duplicatePair()[0], duplicate: duplicatePair()[1],
      overlapFrom: "2026-09-01", overlapTo: null, firstDuplicateDate: "2026-09-01",
    }]);
  });

  it("does not flag properly separated history versions", () => {
    expect(findRecurringDuplicateCandidates([
      rule({ effectiveTo: "2026-09-30" }), rule({ id: "new", effectiveFrom: "2026-10-01" }),
    ])).toEqual([]);
  });

  it.each([
    { title: "第二份薪水" }, { amount: 41000 }, { recordType: "expense" as const },
    { dayOfMonth: "2" }, { frequency: "weekly" as const },
    { frequency: "once" as const, date: "2026-10-01" },
  ])("does not flag a rule with different financial or schedule fields: %j", (different) => {
    expect(findRecurringDuplicateCandidates([rule(), rule({ id: "other", ...different })])).toEqual([]);
  });

  it("does not flag date overlaps with no monthly or weekly occurrence", () => {
    expect(findRecurringDuplicateCandidates([
      rule({ effectiveFrom: "2026-10-06", effectiveTo: "2026-10-09" }),
      rule({ id: "other", effectiveFrom: "2026-10-07", effectiveTo: "2026-10-10" }),
    ])).toEqual([]);
    expect(findRecurringDuplicateCandidates([
      rule({ frequency: "weekly", effectiveFrom: "2026-10-06", effectiveTo: "2026-10-09" }),
      rule({ id: "other", frequency: "weekly", effectiveFrom: "2026-10-07", effectiveTo: "2026-10-10" }),
    ])).toEqual([]);
  });

  it("accounts for clamped monthly and yearly occurrences", () => {
    const monthly = rule({ dayOfMonth: "31", effectiveFrom: "2026-02-01", effectiveTo: "2026-02-28" });
    expect(findRecurringDuplicateCandidates([monthly, { ...monthly, id: "other" }])[0].firstDuplicateDate).toBe("2026-02-28");
    const yearly = rule({ frequency: "yearly", monthOfYear: "2", dayOfMonth: "29", effectiveFrom: "2026-01-01" });
    expect(findRecurringDuplicateCandidates([yearly, { ...yearly, id: "other" }])[0].firstDuplicateDate).toBe("2026-02-28");
  });
});

describe("duplicate storage backup and isolation", () => {
  it("backs up the untouched original before isolating an identical ID copy", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ version: 2, note: "原始內容", records: [rule(), rule()] });
    storage.setItem(CASH_RECORDS_KEY, raw);
    const loaded = loadCashRecords(storage);
    expect(loaded.records).toEqual([rule()]);
    expect(loaded.migrated).toBe(true);
    expect(loaded.quarantined[0]).toMatchObject({ value: rule() });
    expect(loaded.quarantined[0].reason).toContain("完全相同");
    expect(storage.getItem(loaded.backupKey!)).toBe(raw);
    expect(loadCashRecords(storage)).toMatchObject({ migrated: false, backupKey: null, quarantined: [] });
    expect(getQuarantinedRecords(storage)).toHaveLength(1);
  });

  it("isolates exact legacy copies and retains their original unmigrated fields", () => {
    const storage = new MemoryStorage();
    const legacy: Record<string, unknown> = { ...rule() };
    delete legacy.effectiveFrom;
    delete legacy.effectiveTo;
    const raw = JSON.stringify([legacy, legacy]);
    storage.setItem(CASH_RECORDS_KEY, raw);
    const loaded = loadCashRecords(storage);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0].effectiveFrom).toBe("0001-01-01");
    expect(loaded.quarantined[0].value).toEqual(legacy);
    expect(storage.getItem(loaded.backupKey!)).toBe(raw);
  });

  it("previews and restores duplicate copies without importing them twice", () => {
    const raw = envelope([rule(), rule()]);
    const inspected = previewCashRecordsImport(raw);
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.preview.records).toHaveLength(1);
    expect(inspected.preview.totalInput).toBe(2);
    expect(inspected.preview.quarantined).toHaveLength(1);
    const storage = new MemoryStorage();
    expect(restoreCashRecordsFromText(raw, storage).ok).toBe(true);
    expect(loadCashRecords(storage).records).toHaveLength(1);
    expect(getQuarantinedRecords(storage)[0].value).toEqual(rule());
  });

  it("keeps different IDs and altered records without any automatic cleanup", () => {
    const storage = new MemoryStorage();
    const records = [...duplicatePair(), rule({ id: "same-price-other", title: "獎金" })];
    const raw = envelope(records);
    storage.setItem(CASH_RECORDS_KEY, raw);
    const loaded = loadCashRecords(storage);
    expect(loaded.records).toEqual(records);
    expect(loaded.migrated).toBe(false);
    expect(loaded.quarantined).toEqual([]);
    expect(storage.getItem(CASH_RECORDS_KEY)).toBe(raw);
  });

  it("leaves candidate rules unchanged when confirmation is cancelled", () => {
    const storage = new MemoryStorage();
    const raw = envelope(duplicatePair());
    storage.setItem(CASH_RECORDS_KEY, raw);
    expect(resolveRecurringDuplicate("salary-duplicate", "salary-original", false, storage)).toMatchObject({ backupKey: null, quarantined: [] });
    expect(storage.getItem(CASH_RECORDS_KEY)).toBe(raw);
    expect(storage.keys()).toEqual([CASH_RECORDS_KEY]);
  });

  it("isolates only the explicitly selected version and preserves a full backup", () => {
    const storage = new MemoryStorage();
    const independent = rule({ id: "independent", title: "午餐", frequency: "once", recordType: "expense", date: "2026-10-01" });
    const raw = envelope([...duplicatePair(), independent]);
    storage.setItem(CASH_RECORDS_KEY, raw);
    const result = resolveRecurringDuplicate("salary-duplicate", "salary-original", true, storage);
    expect(result.records).toEqual([rule(), independent]);
    expect(storage.getItem(result.backupKey!)).toBe(raw);
    expect(result.quarantined[0].value).toEqual(duplicatePair()[1]);
    expect(getQuarantinedRecords(storage)).toEqual(result.quarantined);
    expect(calculateMonthSummary(result.records, new Date(2026, 9, 1)).income).toBe(40000);
  });

  it("revalidates the pair rather than isolating a changed rule or unrelated equal payment", () => {
    const storage = new MemoryStorage();
    const records = [rule(), rule({ id: "different", title: "第二份薪水" })];
    const raw = envelope(records);
    storage.setItem(CASH_RECORDS_KEY, raw);
    expect(() => resolveRecurringDuplicate("different", "salary-original", true, storage)).toThrow("不符合重複候選");
    expect(storage.getItem(CASH_RECORDS_KEY)).toBe(raw);
    expect(storage.keys()).toEqual([CASH_RECORDS_KEY]);
  });

  it("restores an isolated version without undoing later new transactions", () => {
    const storage = new MemoryStorage();
    storage.setItem(CASH_RECORDS_KEY, envelope(duplicatePair()));
    const result = resolveRecurringDuplicate("salary-duplicate", "salary-original", true, storage);
    const newer = rule({ id: "later", title: "午餐", frequency: "once", date: "2026-10-06" });
    saveCashRecords([...result.records, newer], storage);
    const restored = restoreResolvedRecurringDuplicate(result.quarantined[0], true, storage);
    expect(restored.records.map((record) => record.id)).toEqual(["salary-duplicate", "salary-original", "later"]);
    expect(getQuarantinedRecords(storage)).toEqual([]);
    expect(() => restoreResolvedRecurringDuplicate(result.quarantined[0], true, storage)).toThrow("找不到");
  });

  it("does not overwrite backups when isolation and restoration happen in one millisecond", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T00:00:00.000Z"));
    try {
      const storage = new MemoryStorage();
      const original = envelope(duplicatePair());
      storage.setItem(CASH_RECORDS_KEY, original);
      const result = resolveRecurringDuplicate("salary-duplicate", "salary-original", true, storage);
      const repaired = storage.getItem(CASH_RECORDS_KEY);
      const restored = restoreResolvedRecurringDuplicate(result.quarantined[0], true, storage);
      expect(result.backupKey).not.toBe(restored.backupKey);
      expect(storage.getItem(result.backupKey!)).toBe(original);
      expect(storage.getItem(restored.backupKey!)).toBe(repaired);
      expect(storage.keys().filter((key) => key.startsWith(CASH_RECORDS_BACKUP_PREFIX))).toHaveLength(2);
      expect(storage.getItem(CASH_RECORDS_QUARANTINE_KEY)).toBe("[]");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("conflicting ID recovery without dropping transactions", () => {
  it("backs up and remaps a conflicting ID while retaining all financial and history fields", () => {
    const storage = new MemoryStorage();
    const conflicting = rule({
      amount: 42000, category: "歷史分類", effectiveFrom: "2026-03-01", effectiveTo: "2026-09-30",
    });
    const raw = envelope([rule(), conflicting]);
    storage.setItem(CASH_RECORDS_KEY, raw);
    const loaded = loadCashRecords(storage);
    const recoveredId = "salary-original~recovered-1";
    expect(loaded.records).toEqual([rule(), { ...conflicting, id: recoveredId }]);
    expect(storage.getItem(loaded.backupKey!)).toBe(raw);
    expect(loaded.quarantined).toHaveLength(1);
    expect(loaded.quarantined[0].value).toEqual(conflicting);
    expect(loaded.quarantined[0].reason).toContain(recoveredId);
    expect(loaded.quarantined[0].reason).toContain("全部記帳內容已保留");
    const reloaded = loadCashRecords(storage);
    expect(reloaded.records).toEqual(loaded.records);
    expect(reloaded.migrated).toBe(false);
    expect(getQuarantinedRecords(storage)).toHaveLength(1);
  });

  it("reserves every input ID and deduplicates original copies before remapping", () => {
    const storage = new MemoryStorage();
    const collision = rule({ category: "舊分類" });
    const laterExisting = rule({ id: "salary-original~recovered-1", title: "第二份薪水" });
    const anotherCollision = rule({ amount: 41000 });
    storage.setItem(CASH_RECORDS_KEY, envelope([
      rule(), collision, laterExisting, anotherCollision, { ...collision },
    ]));
    const loaded = loadCashRecords(storage);
    expect(loaded.records).toEqual([
      rule(), { ...collision, id: "salary-original~recovered-2" },
      laterExisting, { ...anotherCollision, id: "salary-original~recovered-3" },
    ]);
    expect(loaded.quarantined).toHaveLength(3);
    expect(loaded.quarantined[2].reason).toContain("完全相同");
    const events = buildMonthlyEvents(loaded.records, new Date(2026, 9, 1));
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    // A differing category with the same financial schedule is now available
    // for manual review, rather than sharing an unsafe edit/delete identity.
    expect(findRecurringDuplicateCandidates(loaded.records)).toHaveLength(1);
  });

  it("does not reuse IDs belonging to invalid rows later in the same input", () => {
    const storage = new MemoryStorage();
    const invalid = { ...rule({ id: "salary-original~recovered-1" }), amount: -1 };
    storage.setItem(CASH_RECORDS_KEY, JSON.stringify({ version: 2, records: [
      rule(), rule({ category: "舊分類" }), invalid,
    ] }));
    expect(loadCashRecords(storage).records[1].id).toBe("salary-original~recovered-2");
  });

  it("uses stable recovered IDs in import preview and restore while preserving raw collision values", () => {
    const conflicting = rule({ category: "歷史分類" });
    const raw = envelope([rule(), conflicting, { ...conflicting }]);
    const first = previewCashRecordsImport(raw);
    const second = previewCashRecordsImport(raw);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.preview.records).toEqual(second.preview.records);
    expect(first.preview.records).toEqual([
      rule(), { ...conflicting, id: "salary-original~recovered-1" },
    ]);
    expect(first.preview.quarantined.map((entry) => entry.value)).toEqual([conflicting, conflicting]);
    const storage = new MemoryStorage();
    const currentRaw = envelope([rule({ id: "current" })]);
    storage.setItem(CASH_RECORDS_KEY, currentRaw);
    const restored = restoreCashRecordsFromText(raw, storage);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(storage.getItem(restored.backupKey!)).toBe(currentRaw);
    expect(loadCashRecords(storage).records).toEqual(first.preview.records);
    expect(getQuarantinedRecords(storage).map((entry) => entry.value)).toEqual([conflicting, conflicting]);
  });

  it("preserves legacy financial fields when conflicting IDs require schema migration", () => {
    const storage = new MemoryStorage();
    const original: Record<string, unknown> = { ...rule() };
    delete original.effectiveFrom;
    delete original.effectiveTo;
    const conflicting = { ...original, category: "保留的舊分類", amount: 42000 };
    const raw = JSON.stringify([original, conflicting]);
    storage.setItem(CASH_RECORDS_KEY, raw);
    const loaded = loadCashRecords(storage);
    expect(loaded.records).toEqual([
      rule({ effectiveFrom: "0001-01-01" }),
      rule({ id: "salary-original~recovered-1", category: "保留的舊分類", amount: 42000, effectiveFrom: "0001-01-01" }),
    ]);
    expect(storage.getItem(loaded.backupKey!)).toBe(raw);
    expect(loaded.quarantined[0].value).toEqual(conflicting);
  });

  it.each([{}, { category: "不同分類" }, { amount: 41000 }])("rejects every duplicate ID before changing stored data: %j", (different) => {
    const storage = new MemoryStorage();
    const raw = envelope([rule({ id: "existing" })]);
    storage.setItem(CASH_RECORDS_KEY, raw);
    expect(() => saveCashRecords([rule(), rule(different)], storage)).toThrow("重複的記帳 ID");
    expect(storage.getItem(CASH_RECORDS_KEY)).toBe(raw);
    expect(storage.keys()).toEqual([CASH_RECORDS_KEY]);
  });
});
