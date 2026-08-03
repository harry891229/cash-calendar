import { isDateText } from "@/lib/date";
import { isPositiveNtd } from "@/lib/money";
import {
  CASH_RECORDS_VERSION,
  isFrequency,
  isRecordType,
  LEGACY_EFFECTIVE_FROM,
  WEEKDAYS,
  type CashRecord,
  type CashRecordsEnvelope,
  type QuarantinedRecord,
} from "@/types/cash-record";

export const CASH_RECORDS_KEY = "cashRecords";
export const CASH_RECORDS_QUARANTINE_KEY = "cashRecordsQuarantine";
export const CASH_RECORDS_BACKUP_PREFIX = "cashRecordsBackupV1";

export type StorageLoadResult = {
  records: CashRecord[];
  quarantined: QuarantinedRecord[];
  migrated: boolean;
  backupKey: string | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerText(value: unknown, min: number, max: number) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function validateRecord(
  value: unknown,
  legacy: boolean
): { record: CashRecord | null; reason: string | null } {
  if (!isPlainObject(value)) {
    return { record: null, reason: "紀錄不是物件" };
  }

  const requiredStrings = [
    "id",
    "title",
    "date",
    "dayOfMonth",
    "dayOfWeek",
    "monthOfYear",
    "category",
    "createdAt",
  ] as const;

  for (const field of requiredStrings) {
    if (typeof value[field] !== "string") {
      return { record: null, reason: `${field} 格式錯誤` };
    }
  }

  if (!value.id || !value.title || !value.category) {
    return { record: null, reason: "必要文字欄位為空" };
  }

  if (!isPositiveNtd(value.amount)) {
    return { record: null, reason: "金額不是安全的正整數" };
  }

  if (!isRecordType(value.recordType) || !isFrequency(value.frequency)) {
    return { record: null, reason: "收支類型或週期錯誤" };
  }

  if (value.frequency === "once" && !isDateText(value.date)) {
    return { record: null, reason: "單次紀錄日期錯誤" };
  }

  if (
    (value.frequency === "monthly" || value.frequency === "yearly") &&
    !isIntegerText(value.dayOfMonth, 1, 31)
  ) {
    return { record: null, reason: "每月日期錯誤" };
  }

  if (
    value.frequency === "weekly" &&
    !WEEKDAYS.includes(value.dayOfWeek as (typeof WEEKDAYS)[number])
  ) {
    return { record: null, reason: "星期格式錯誤" };
  }

  if (
    value.frequency === "yearly" &&
    !isIntegerText(value.monthOfYear, 1, 12)
  ) {
    return { record: null, reason: "每年月份錯誤" };
  }

  const effectiveFrom = legacy
    ? value.frequency === "once"
      ? value.date
      : LEGACY_EFFECTIVE_FROM
    : value.effectiveFrom;
  const effectiveTo = legacy ? null : value.effectiveTo;

  if (!isDateText(effectiveFrom)) {
    return { record: null, reason: "生效日期錯誤" };
  }

  if (
    effectiveTo !== null &&
    (!isDateText(effectiveTo) || effectiveTo < effectiveFrom)
  ) {
    return { record: null, reason: "停止日期錯誤" };
  }

  return {
    record: {
      id: value.id as string,
      title: value.title as string,
      amount: value.amount,
      recordType: value.recordType,
      frequency: value.frequency,
      date: value.date as string,
      dayOfMonth: value.dayOfMonth as string,
      dayOfWeek: value.dayOfWeek as string,
      monthOfYear: value.monthOfYear as string,
      category: value.category as string,
      createdAt: value.createdAt as string,
      effectiveFrom,
      effectiveTo,
    },
    reason: null,
  };
}

function quarantineValues(values: unknown[], reasonPrefix = "") {
  const now = new Date().toISOString();
  return values.map((value, index): QuarantinedRecord => {
    const result = validateRecord(value, false);
    return {
      reason: `${reasonPrefix}${result.reason ?? `第 ${index + 1} 筆資料錯誤`}`,
      value,
      quarantinedAt: now,
    };
  });
}

function saveBackup(storage: StorageLike, raw: string) {
  const backupKey = `${CASH_RECORDS_BACKUP_PREFIX}:${new Date().toISOString()}`;
  storage.setItem(backupKey, raw);
  return backupKey;
}

function saveQuarantine(
  storage: StorageLike,
  quarantined: QuarantinedRecord[]
) {
  if (quarantined.length === 0) return;

  let existing: QuarantinedRecord[] = [];
  const existingText = storage.getItem(CASH_RECORDS_QUARANTINE_KEY);

  if (existingText) {
    try {
      const parsed = JSON.parse(existingText);
      if (Array.isArray(parsed)) existing = parsed;
    } catch {
      existing = [];
    }
  }

  storage.setItem(
    CASH_RECORDS_QUARANTINE_KEY,
    JSON.stringify([...existing, ...quarantined])
  );
}

export function saveCashRecords(
  records: CashRecord[],
  storage: StorageLike = localStorage
) {
  for (const record of records) {
    const validation = validateRecord(record, false);
    if (!validation.record) {
      throw new Error(`拒絕寫入不合法記帳資料：${validation.reason}`);
    }
  }

  const envelope: CashRecordsEnvelope = {
    version: CASH_RECORDS_VERSION,
    records,
  };
  storage.setItem(CASH_RECORDS_KEY, JSON.stringify(envelope));
}

export function clearCashRecordsSafely(
  storage: StorageLike = localStorage
): string | null {
  const raw = storage.getItem(CASH_RECORDS_KEY);
  const backupKey = raw === null ? null : saveBackup(storage, raw);
  saveCashRecords([], storage);
  return backupKey;
}

export function loadCashRecords(
  storage: StorageLike = localStorage
): StorageLoadResult {
  const raw = storage.getItem(CASH_RECORDS_KEY);

  if (raw === null) {
    return { records: [], quarantined: [], migrated: false, backupKey: null };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupKey = saveBackup(storage, raw);
    const quarantined: QuarantinedRecord[] = [
      {
        reason: "cashRecords 不是有效 JSON",
        value: raw,
        quarantinedAt: new Date().toISOString(),
      },
    ];
    saveQuarantine(storage, quarantined);
    saveCashRecords([], storage);
    return { records: [], quarantined, migrated: true, backupKey };
  }

  const isLegacy = Array.isArray(parsed);
  const isV2 =
    isPlainObject(parsed) &&
    parsed.version === CASH_RECORDS_VERSION &&
    Array.isArray(parsed.records);

  if (!isLegacy && !isV2) {
    const backupKey = saveBackup(storage, raw);
    const quarantined = quarantineValues([parsed], "資料包裝格式錯誤：");
    saveQuarantine(storage, quarantined);
    saveCashRecords([], storage);
    return { records: [], quarantined, migrated: true, backupKey };
  }

  const values: unknown[] = isLegacy
    ? (parsed as unknown[])
    : ((parsed as Record<string, unknown>).records as unknown[]);
  const records: CashRecord[] = [];
  const quarantined: QuarantinedRecord[] = [];

  for (const value of values) {
    const result = validateRecord(value, isLegacy);
    if (result.record) {
      records.push(result.record);
    } else {
      quarantined.push({
        reason: result.reason ?? "未知資料錯誤",
        value,
        quarantinedAt: new Date().toISOString(),
      });
    }
  }

  const needsRewrite = isLegacy || quarantined.length > 0;
  let backupKey: string | null = null;

  if (needsRewrite) {
    backupKey = saveBackup(storage, raw);
    saveQuarantine(storage, quarantined);
    saveCashRecords(records, storage);
  }

  return {
    records,
    quarantined,
    migrated: needsRewrite,
    backupKey,
  };
}
