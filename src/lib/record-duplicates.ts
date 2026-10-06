import type { CashRecord } from "@/types/cash-record";

// Include identity and every stored field. Equal amounts or matching schedules alone
// are never enough evidence to remove a record.
export function cashRecordFingerprint(record: CashRecord) {
  return JSON.stringify([
    record.id,
    record.title,
    record.amount,
    record.recordType,
    record.frequency,
    record.date,
    record.dayOfMonth,
    record.dayOfWeek,
    record.monthOfYear,
    record.category,
    record.createdAt,
    record.effectiveFrom,
    record.effectiveTo,
  ]);
}

export function deduplicateIdenticalCashRecords(records: CashRecord[]) {
  const seen = new Set<string>();
  const unique: CashRecord[] = [];
  const duplicates: CashRecord[] = [];

  for (const record of records) {
    const fingerprint = cashRecordFingerprint(record);
    if (seen.has(fingerprint)) {
      duplicates.push(record);
    } else {
      seen.add(fingerprint);
      unique.push(record);
    }
  }

  return { records: unique, duplicates };
}
