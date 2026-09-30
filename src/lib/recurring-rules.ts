import { getWeekdayText, nextDateText, toDateText } from "@/lib/date";
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
