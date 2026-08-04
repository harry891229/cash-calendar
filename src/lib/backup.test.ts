import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import {
  CASH_CALENDAR_APP_ID,
  createCashCalendarBackup,
} from "@/lib/backup";
import { APP_VERSION } from "@/lib/app-info";
import { createDefaultCategorySettings } from "@/lib/categories";
import { createDefaultBudgetSettings } from "@/lib/settings-storage";
import {
  CASH_RECORDS_BACKUP_PREFIX,
  CASH_RECORDS_KEY,
  CASH_RECORDS_QUARANTINE_KEY,
  previewCashRecordsImport,
  restoreCashRecordsFromText,
} from "@/lib/storage";
import { CASH_RECORDS_VERSION, type CashRecord } from "@/types/cash-record";

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
    title: "薪水",
    amount: 50000,
    recordType: "income",
    frequency: "monthly",
    date: "2026-01-01",
    dayOfMonth: "5",
    dayOfWeek: "星期一",
    monthOfYear: "1",
    category: "薪水",
    createdAt: "2026-01-01T00:00:00.000Z",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    ...overrides,
  };
}

function envelope(records: unknown[]) {
  return JSON.stringify({
    app: CASH_CALENDAR_APP_ID,
    version: CASH_RECORDS_VERSION,
    exportedAt: "2026-08-03T01:02:03.000Z",
    records,
  });
}

describe("backup export and restore", () => {
  it("creates a backup with version, records, exportedAt and app identifier", () => {
    const exportedAt = new Date("2026-08-03T01:02:03.000Z");
    const budgetSettings = createDefaultBudgetSettings();
    const categorySettings = createDefaultCategorySettings();
    const backup = createCashCalendarBackup(
      [record()],
      budgetSettings,
      categorySettings,
      exportedAt
    );

    expect(backup).toEqual({
      app: CASH_CALENDAR_APP_ID,
      version: CASH_RECORDS_VERSION,
      exportedAt: exportedAt.toISOString(),
      appVersion: APP_VERSION,
      records: [record()],
      budgetSettings,
      categorySettings,
    });
  });

  it("restores a valid v2 backup", () => {
    const storage = new MemoryStorage();
    const result = restoreCashRecordsFromText(envelope([record()]), storage);

    expect(result.ok).toBe(true);
    const saved = JSON.parse(storage.getItem(CASH_RECORDS_KEY) ?? "");
    expect(saved.version).toBe(2);
    expect(saved.records).toEqual([record()]);
  });

  it("imports and migrates a legacy array", () => {
    const legacy = { ...record() } as Record<string, unknown>;
    delete legacy.effectiveFrom;
    delete legacy.effectiveTo;

    const result = previewCashRecordsImport(JSON.stringify([legacy]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.sourceFormat).toBe("legacy");
    expect(result.preview.records[0].effectiveFrom).toBe("0001-01-01");
  });

  it("does not overwrite current data when JSON is malformed", () => {
    const storage = new MemoryStorage();
    const current = JSON.stringify({ version: 2, records: [record()] });
    storage.setItem(CASH_RECORDS_KEY, current);

    const result = restoreCashRecordsFromText("{broken", storage);
    expect(result.ok).toBe(false);
    expect(storage.getItem(CASH_RECORDS_KEY)).toBe(current);
  });

  it("isolates invalid records while restoring valid records", () => {
    const storage = new MemoryStorage();
    const invalid = { ...record({ id: "bad" }), amount: 1.5 };

    const result = restoreCashRecordsFromText(
      envelope([record(), invalid]),
      storage
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.records).toHaveLength(1);
    expect(result.preview.quarantined).toHaveLength(1);
    expect(storage.getItem(CASH_RECORDS_QUARANTINE_KEY)).toContain('"id":"bad"');
  });

  it("backs up current cashRecords before replacement", () => {
    const storage = new MemoryStorage();
    const current = JSON.stringify({
      version: 2,
      records: [record({ id: "current" })],
    });
    storage.setItem(CASH_RECORDS_KEY, current);

    const result = restoreCashRecordsFromText(
      envelope([record({ id: "replacement" })]),
      storage
    );
    expect(result.ok).toBe(true);
    const backupKey = storage
      .keys()
      .find((key) => key.startsWith(CASH_RECORDS_BACKUP_PREFIX));
    expect(backupKey).toBeDefined();
    expect(storage.getItem(backupKey ?? "")).toBe(current);
  });
});

describe("PWA manifest", () => {
  it("contains the required install fields and icons", () => {
    const value = manifest();
    expect(value.name).toBe("記帳月曆");
    expect(value.short_name).toBe("記帳");
    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
    expect(value.scope).toBe("/");
    expect(value.theme_color).toBe("#0f172a");
    expect(value.background_color).toBe("#020617");
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ])
    );
  });
});
