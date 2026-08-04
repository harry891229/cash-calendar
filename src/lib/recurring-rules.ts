import { toDateText } from "@/lib/date";
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
