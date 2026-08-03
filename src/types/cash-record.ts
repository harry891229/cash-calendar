export type RecordType = "expense" | "income";
export type Frequency = "once" | "monthly" | "weekly" | "yearly";

export type CashRecord = {
  id: string;
  title: string;
  amount: number;
  recordType: RecordType;
  frequency: Frequency;
  date: string;
  dayOfMonth: string;
  dayOfWeek: string;
  monthOfYear: string;
  category: string;
  createdAt: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type CashEvent = {
  id: string;
  recordId: string;
  title: string;
  amount: number;
  recordType: RecordType;
  frequency: Frequency;
  category: string;
  dateText: string;
  day: number;
};

export type CashRecordsEnvelope = {
  version: 2;
  records: CashRecord[];
};

export type QuarantinedRecord = {
  reason: string;
  value: unknown;
  quarantinedAt: string;
};

export const CASH_RECORDS_VERSION = 2 as const;
export const LEGACY_EFFECTIVE_FROM = "0001-01-01";
export const WEEKDAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
] as const;

export function isRecordType(value: unknown): value is RecordType {
  return value === "expense" || value === "income";
}

export function isFrequency(value: unknown): value is Frequency {
  return (
    value === "once" ||
    value === "monthly" ||
    value === "weekly" ||
    value === "yearly"
  );
}
