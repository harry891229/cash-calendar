import { toDateText } from "@/lib/date";
import { CASH_RECORDS_VERSION, type CashRecord } from "@/types/cash-record";
import type { BudgetSettings, CategorySettings } from "@/types/settings";
import { APP_ID, APP_VERSION } from "@/lib/app-info";

export const CASH_CALENDAR_APP_ID = APP_ID;

export type CashCalendarBackup = {
  app: typeof CASH_CALENDAR_APP_ID;
  version: typeof CASH_RECORDS_VERSION;
  exportedAt: string;
  appVersion: string;
  records: CashRecord[];
  budgetSettings: BudgetSettings;
  categorySettings: CategorySettings;
};

export function createCashCalendarBackup(
  records: CashRecord[],
  budgetSettings: BudgetSettings,
  categorySettings: CategorySettings,
  exportedAt = new Date()
): CashCalendarBackup {
  return {
    app: CASH_CALENDAR_APP_ID,
    version: CASH_RECORDS_VERSION,
    exportedAt: exportedAt.toISOString(),
    appVersion: APP_VERSION,
    records,
    budgetSettings,
    categorySettings,
  };
}

export function getBackupFilename(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `cash-calendar-backup-${toDateText(date)}-${hours}${minutes}.json`;
}
