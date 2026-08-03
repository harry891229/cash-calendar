import type { CashEvent, CashRecord } from "@/types/cash-record";

export const MAX_NTD_AMOUNT = Number.MAX_SAFE_INTEGER;

export function parsePositiveNtd(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }

  const amount = Number(value);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

export function isPositiveNtd(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_NTD_AMOUNT
  );
}

export function formatMoney(value: number) {
  const absValue = Math.abs(value);
  const formatted = `$${absValue.toLocaleString("zh-TW")}`;
  return value < 0 ? `-${formatted}` : formatted;
}

export function getSignedAmount(
  record: Pick<CashRecord | CashEvent, "recordType" | "amount">
) {
  return record.recordType === "expense" ? -record.amount : record.amount;
}

export function sumAmounts(
  items: Array<Pick<CashRecord | CashEvent, "amount">>
) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function sumSignedAmounts(
  items: Array<Pick<CashRecord | CashEvent, "recordType" | "amount">>
) {
  return items.reduce((sum, item) => sum + getSignedAmount(item), 0);
}
