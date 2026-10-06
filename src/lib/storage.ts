import { isDateText } from "@/lib/date";
import { isPositiveNtd } from "@/lib/money";
import { cashRecordFingerprint } from "@/lib/record-duplicates";
import { findRecurringDuplicateCandidates } from "@/lib/recurring-rules";
import { createDefaultCategorySettings } from "@/lib/categories";
import {
  backupCurrentSettings,
  createDefaultBudgetSettings,
  isBudgetSettings,
  isCategorySettings,
  saveBudgetSettings,
  saveCategorySettings,
} from "@/lib/settings-storage";
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
import type { BudgetSettings, CategorySettings } from "@/types/settings";

export const CASH_RECORDS_KEY = "cashRecords";
export const CASH_RECORDS_QUARANTINE_KEY = "cashRecordsQuarantine";
export const CASH_RECORDS_BACKUP_PREFIX = "cashRecordsBackupV1";

export type StorageLoadResult = {
  records: CashRecord[];
  quarantined: QuarantinedRecord[];
  migrated: boolean;
  backupKey: string | null;
};

export type CashRecordsImportPreview = {
  records: CashRecord[];
  quarantined: QuarantinedRecord[];
  sourceFormat: "v2" | "legacy";
  totalInput: number;
  exportedAt: string | null;
  app: string | null;
  appVersion: string | null;
  budgetSettings: BudgetSettings;
  categorySettings: CategorySettings;
  includesBudget: boolean;
  includesCustomCategories: boolean;
};

export type CashRecordsImportResult =
  | { ok: true; preview: CashRecordsImportPreview; backupKey: string | null }
  | { ok: false; error: string };

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
  const baseKey = `${CASH_RECORDS_BACKUP_PREFIX}:${new Date().toISOString()}`;
  let backupKey = baseKey;
  let suffix = 1;
  while (storage.getItem(backupKey) !== null) {
    backupKey = `${baseKey}:${suffix++}`;
  }
  storage.setItem(backupKey, raw);
  return backupKey;
}

function inspectRecordValues(values: unknown[], legacy: boolean) {
  const records: CashRecord[] = [];
  const quarantined: QuarantinedRecord[] = [];
  const fingerprints = new Set<string>();
  const usedIds = new Set<string>();
  // Reserve IDs from the entire input, including later rows. Recovery must not
  // claim an ID that already belongs to an independent record in this import.
  const reservedIds = new Set(values.flatMap((value) =>
    isPlainObject(value) && typeof value.id === "string" ? [value.id] : []
  ));
  const now = new Date().toISOString();

  for (const value of values) {
    const result = validateRecord(value, legacy);
    if (!result.record) {
      quarantined.push({ reason: result.reason ?? "未知資料錯誤", value, quarantinedAt: now });
      continue;
    }
    const fingerprint = cashRecordFingerprint(result.record);
    if (fingerprints.has(fingerprint)) {
      quarantined.push({
        reason: "完全相同的重複紀錄（相同 ID），已保留第一筆並隔離副本",
        value,
        quarantinedAt: now,
      });
      continue;
    }
    // Compare original fingerprints before remapping, so a repeated copy of an
    // ID collision is still isolated rather than receiving yet another new ID.
    fingerprints.add(fingerprint);
    let record = result.record;
    if (usedIds.has(record.id)) {
      let suffix = 1;
      let recoveredId = `${record.id}~recovered-${suffix}`;
      while (reservedIds.has(recoveredId) || usedIds.has(recoveredId)) {
        recoveredId = `${record.id}~recovered-${++suffix}`;
      }
      quarantined.push({
        reason: `紀錄 ID 衝突（原 ID ${record.id}；已改配唯一 ID ${recoveredId}，全部記帳內容已保留；此處保存原始衝突資料）`,
        value,
        quarantinedAt: now,
      });
      record = { ...record, id: recoveredId };
    }
    usedIds.add(record.id);
    records.push(record);
  }
  return { records, quarantined };
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

export function getQuarantinedRecords(
  storage: StorageLike = localStorage
): QuarantinedRecord[] {
  const raw = storage.getItem(CASH_RECORDS_QUARANTINE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function previewCashRecordsImport(
  raw: string
): { ok: true; preview: CashRecordsImportPreview } | { ok: false; error: string } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "備份檔不是有效的 JSON。" };
  }

  const isLegacy = Array.isArray(parsed);
  const isV2 =
    isPlainObject(parsed) &&
    parsed.version === CASH_RECORDS_VERSION &&
    Array.isArray(parsed.records);

  if (!isLegacy && !isV2) {
    return { ok: false, error: "不支援的備份格式或 schema version。" };
  }

  const values: unknown[] = isLegacy
    ? (parsed as unknown[])
    : ((parsed as Record<string, unknown>).records as unknown[]);
  const { records, quarantined } = inspectRecordValues(values, isLegacy);

  const metadata = isV2 ? (parsed as Record<string, unknown>) : null;
  const rawBudgetSettings = metadata?.budgetSettings;
  const rawCategorySettings = metadata?.categorySettings;
  const budgetSettings = isBudgetSettings(rawBudgetSettings)
    ? rawBudgetSettings
    : createDefaultBudgetSettings();
  const categorySettings = isCategorySettings(rawCategorySettings)
    ? rawCategorySettings
    : createDefaultCategorySettings();
  return {
    ok: true,
    preview: {
      records,
      quarantined,
      sourceFormat: isLegacy ? "legacy" : "v2",
      totalInput: values.length,
      exportedAt:
        typeof metadata?.exportedAt === "string" ? metadata.exportedAt : null,
      app: typeof metadata?.app === "string" ? metadata.app : null,
      appVersion:
        typeof metadata?.appVersion === "string" ? metadata.appVersion : null,
      budgetSettings,
      categorySettings,
      includesBudget: isBudgetSettings(rawBudgetSettings),
      includesCustomCategories:
        isCategorySettings(rawCategorySettings) &&
        rawCategorySettings.categories.some((category) => !category.isSystem),
    },
  };
}

export function restoreCashRecordsFromText(
  raw: string,
  storage: StorageLike = localStorage
): CashRecordsImportResult {
  const inspected = previewCashRecordsImport(raw);
  if (!inspected.ok) return inspected;

  const currentRaw = storage.getItem(CASH_RECORDS_KEY);
  const backupKey =
    currentRaw === null ? null : saveBackup(storage, currentRaw);

  backupCurrentSettings(storage);
  saveQuarantine(storage, inspected.preview.quarantined);
  saveCashRecords(inspected.preview.records, storage);
  saveBudgetSettings(inspected.preview.budgetSettings, storage);
  saveCategorySettings(inspected.preview.categorySettings, storage);
  return { ok: true, preview: inspected.preview, backupKey };
}

export function saveCashRecords(
  records: CashRecord[],
  storage: StorageLike = localStorage
) {
  const ids = new Set<string>();
  for (const record of records) {
    const validation = validateRecord(record, false);
    if (!validation.record) {
      throw new Error(`拒絕寫入不合法記帳資料：${validation.reason}`);
    }
    if (ids.has(record.id)) {
      throw new Error(`拒絕寫入重複的記帳 ID：${record.id}`);
    }
    ids.add(record.id);
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
  const { records, quarantined } = inspectRecordValues(values, isLegacy);

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

export type RecurringDuplicateResolution = {
  records: CashRecord[];
  backupKey: string | null;
  quarantined: QuarantinedRecord[];
};

export function resolveRecurringDuplicate(
  duplicateId: string,
  keepId: string,
  confirmed: boolean,
  storage: StorageLike = localStorage
): RecurringDuplicateResolution {
  const { records } = loadCashRecords(storage);
  if (!confirmed) return { records, backupKey: null, quarantined: [] };
  const duplicate = records.find((record) => record.id === duplicateId);
  const candidates = findRecurringDuplicateCandidates(records);
  const candidate = candidates.find(({ original, duplicate: other }) =>
    (original.id === keepId && other.id === duplicateId) ||
    (original.id === duplicateId && other.id === keepId)
  );
  if (!duplicate || !candidate || duplicateId === keepId) {
    throw new Error("這兩筆固定規則已不符合重複候選，請重新檢查");
  }
  if (
    records.filter((record) => record.id === duplicateId).length !== 1 ||
    records.filter((record) => record.id === keepId).length !== 1
  ) {
    throw new Error("規則 ID 不唯一，無法安全隔離，請先下載備份檢查");
  }

  const raw = storage.getItem(CASH_RECORDS_KEY);
  const backupKey = raw === null ? null : saveBackup(storage, raw);
  const quarantined: QuarantinedRecord[] = [{
    reason: `疑似重複固定規則（使用者確認隔離；保留 ${keepId}）`,
    value: duplicate,
    quarantinedAt: new Date().toISOString(),
  }];
  const nextRecords = records.filter((record) => record.id !== duplicateId);
  saveQuarantine(storage, quarantined);
  saveCashRecords(nextRecords, storage);
  return { records: nextRecords, backupKey, quarantined };
}

export function restoreResolvedRecurringDuplicate(
  isolated: QuarantinedRecord,
  confirmed: boolean,
  storage: StorageLike = localStorage
) {
  const { records } = loadCashRecords(storage);
  if (!confirmed) return { records, backupKey: null };
  const quarantine = getQuarantinedRecords(storage);
  const isolatedIndex = quarantine.findIndex((entry) =>
    entry.reason === isolated.reason &&
    entry.quarantinedAt === isolated.quarantinedAt &&
    JSON.stringify(entry.value) === JSON.stringify(isolated.value)
  );
  if (isolatedIndex === -1 || !isolated.reason.startsWith("疑似重複固定規則（使用者確認隔離；")) {
    throw new Error("找不到可復原的固定規則隔離資料");
  }
  const validation = validateRecord(isolated.value, false);
  const record = validation.record;
  if (!record || record.frequency === "once") {
    throw new Error("隔離規則格式不合法，請使用原始備份檢查");
  }
  if (records.some((existing) => existing.id === record.id)) {
    throw new Error("此規則 ID 已存在，無法重複復原");
  }

  const raw = storage.getItem(CASH_RECORDS_KEY);
  const backupKey = raw === null ? null : saveBackup(storage, raw);
  const nextRecords = [record, ...records];
  saveCashRecords(nextRecords, storage);
  storage.setItem(CASH_RECORDS_QUARANTINE_KEY, JSON.stringify(
    quarantine.filter((_, index) => index !== isolatedIndex)
  ));
  return { records: nextRecords, backupKey };
}
