import {
  clampDayToMonth,
  getWeekdayText,
  nextDateText,
  parseDateText,
  previousDateText,
  toDateText,
} from "@/lib/date";
import { cashRecordFingerprint } from "@/lib/record-duplicates";
import type { CashRecord } from "@/types/cash-record";

export function stopRecurringRule(
  records: CashRecord[],
  recordId: string,
  stoppedOn: Date
) {
  const target = records.find((record) => record.id === recordId);
  if (!target || target.frequency === "once") {
    throw new Error("找不到固定規則");
  }
  if (target.effectiveTo !== null) return records;
  const today = toDateText(stoppedOn);
  const effectiveTo = today < target.effectiveFrom ? target.effectiveFrom : today;
  return records.map((record) =>
    record.id === recordId ? { ...record, effectiveTo } : record
  );
}

export function getRecurringEditEffectiveFrom(
  record: CashRecord,
  today: Date
) {
  if (record.frequency === "once") return record.date;
  const dayAfterOriginalStart = nextDateText(record.effectiveFrom);
  if (!dayAfterOriginalStart) {
    throw new Error("固定規則的生效日期不合法");
  }
  const todayText = toDateText(today);
  return todayText > record.effectiveFrom ? todayText : dayAfterOriginalStart;
}

export function getNewRecurringDefaults(today: Date) {
  return {
    effectiveFrom: toDateText(today),
    dayOfMonth: String(today.getDate()),
    dayOfWeek: getWeekdayText(today),
    monthOfYear: String(today.getMonth() + 1),
  };
}

export function replaceRecurringRuleVersion(
  records: CashRecord[],
  recordId: string,
  replacement: CashRecord,
  expectedOriginal?: CashRecord
) {
  const targets = records.filter((record) => record.id === recordId);
  const target = targets[0];
  if (!target || target.frequency === "once") {
    throw new Error("找不到固定規則，請重新載入後再編輯");
  }
  if (targets.length !== 1) {
    throw new Error("固定規則 ID 重複，請先檢查資料管理");
  }
  if (target.effectiveTo !== null) {
    throw new Error("此固定規則版本已停止，請從設定編輯生效中的版本");
  }
  if (
    expectedOriginal &&
    cashRecordFingerprint(target) !== cashRecordFingerprint(expectedOriginal)
  ) {
    throw new Error("固定規則已被修改，請重新載入後再編輯");
  }
  if (!replacement.id || records.some((record) => record.id === replacement.id)) {
    throw new Error("新固定規則版本必須使用不同的 ID");
  }
  const effectiveFrom = replacement.frequency === "once"
    ? replacement.date
    : replacement.effectiveFrom;
  if (!parseDateText(effectiveFrom) || effectiveFrom <= target.effectiveFrom) {
    throw new Error(`新規則生效日必須晚於 ${target.effectiveFrom}`);
  }
  const effectiveTo = previousDateText(effectiveFrom);
  if (!effectiveTo) throw new Error("無法建立歷史結束日期");

  return [
    { ...replacement, effectiveFrom, effectiveTo: null },
    ...records.map((record) => record.id === recordId
      ? { ...record, effectiveTo }
      : record),
  ];
}

export type RecurringDuplicateCandidate = {
  original: CashRecord;
  duplicate: CashRecord;
  overlapFrom: string;
  overlapTo: string | null;
  firstDuplicateDate: string;
};

function recurringSchedule(record: CashRecord) {
  if (record.frequency === "monthly") return [Number(record.dayOfMonth)];
  if (record.frequency === "weekly") return [record.dayOfWeek];
  return [Number(record.monthOfYear), Number(record.dayOfMonth)];
}

function recurringCandidateKey(record: CashRecord) {
  return JSON.stringify([
    record.title.trim(),
    record.amount,
    record.recordType,
    record.frequency,
    recurringSchedule(record),
  ]);
}

function firstOccurrenceOnOrAfter(record: CashRecord, from: string) {
  const start = parseDateText(from);
  if (!start) return null;
  const occurrence = new Date(start);
  if (record.frequency === "weekly") {
    for (let offset = 0; offset < 7; offset++) {
      if (getWeekdayText(occurrence) === record.dayOfWeek) {
        return toDateText(occurrence);
      }
      occurrence.setDate(occurrence.getDate() + 1);
    }
    return null;
  }

  occurrence.setDate(1);
  if (record.frequency === "yearly") {
    occurrence.setMonth(Number(record.monthOfYear) - 1);
  }
  function applyDay() {
    occurrence.setDate(clampDayToMonth(
      occurrence.getFullYear(),
      occurrence.getMonth(),
      Number(record.dayOfMonth)
    ));
  }
  applyDay();
  if (toDateText(occurrence) < from) {
    occurrence.setDate(1);
    if (record.frequency === "monthly") {
      occurrence.setMonth(occurrence.getMonth() + 1);
    } else {
      occurrence.setFullYear(occurrence.getFullYear() + 1);
    }
    applyDay();
  }
  return toDateText(occurrence);
}

// These are review candidates, not proven duplicates. Independent rules may have
// identical names, amounts and schedules, so different IDs always need a choice.
export function findRecurringDuplicateCandidates(records: CashRecord[]) {
  const groups = new Map<string, CashRecord[]>();
  const candidates: RecurringDuplicateCandidate[] = [];
  for (const record of records) {
    if (record.frequency === "once") continue;
    const key = recurringCandidateKey(record);
    const previous = groups.get(key) ?? [];
    for (const original of previous) {
      if (original.id === record.id) continue;
      const overlapFrom = original.effectiveFrom > record.effectiveFrom
        ? original.effectiveFrom
        : record.effectiveFrom;
      const endings = [original.effectiveTo, record.effectiveTo]
        .filter((ending): ending is string => ending !== null);
      const overlapTo = endings.length === 0 ? null : endings.sort()[0];
      if (overlapTo !== null && overlapTo < overlapFrom) continue;
      const firstDuplicateDate = firstOccurrenceOnOrAfter(record, overlapFrom);
      if (!firstDuplicateDate || (overlapTo !== null && firstDuplicateDate > overlapTo)) continue;
      candidates.push({ original, duplicate: record, overlapFrom, overlapTo, firstDuplicateDate });
    }
    previous.push(record);
    groups.set(key, previous);
  }
  return candidates;
}

export function permanentlyDeleteRecurringVersion(
  records: CashRecord[],
  recordId: string,
  confirmed: boolean
) {
  if (!confirmed) return records;
  const target = records.find((record) => record.id === recordId);
  if (!target || target.frequency === "once") {
    throw new Error("找不到固定規則");
  }
  return records.filter((record) => record.id !== recordId);
}
