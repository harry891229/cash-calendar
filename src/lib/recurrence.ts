import {
  getDateForClampedDay,
  getDaysInMonth,
  getWeekdayText,
  isSameMonth,
  parseDateText,
  toDateText,
} from "@/lib/date";
import { sumAmounts } from "@/lib/money";
import type {
  CashEvent,
  CashRecord,
  Frequency,
  RecordType,
} from "@/types/cash-record";

export function isRecurringRecord(record: CashRecord) {
  return record.frequency !== "once";
}

export function isRecordEffectiveOn(record: CashRecord, dateText: string) {
  if (!isRecurringRecord(record)) {
    return record.date === dateText;
  }

  return (
    dateText >= record.effectiveFrom &&
    (record.effectiveTo === null || dateText <= record.effectiveTo)
  );
}

function toEvent(record: CashRecord, date: Date): CashEvent {
  const dateText = toDateText(date);
  return {
    id: `${record.id}-${dateText}`,
    recordId: record.id,
    title: record.title,
    amount: record.amount,
    recordType: record.recordType,
    frequency: record.frequency,
    category: record.category,
    dateText,
    day: date.getDate(),
  };
}

export function buildMonthlyEvents(records: CashRecord[], baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDay = getDaysInMonth(year, month);
  const events: CashEvent[] = [];

  for (const record of records) {
    if (record.frequency === "once") {
      if (!isSameMonth(record.date, baseDate)) continue;
      const date = parseDateText(record.date);
      if (date) events.push(toEvent(record, date));
      continue;
    }

    if (record.frequency === "monthly") {
      const date = getDateForClampedDay(year, month, Number(record.dayOfMonth));
      const dateText = toDateText(date);
      if (isRecordEffectiveOn(record, dateText)) {
        events.push(toEvent(record, date));
      }
      continue;
    }

    if (record.frequency === "weekly") {
      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        const dateText = toDateText(date);
        if (
          getWeekdayText(date) === record.dayOfWeek &&
          isRecordEffectiveOn(record, dateText)
        ) {
          events.push(toEvent(record, date));
        }
      }
      continue;
    }

    if (Number(record.monthOfYear) === month + 1) {
      const date = getDateForClampedDay(year, month, Number(record.dayOfMonth));
      const dateText = toDateText(date);
      if (isRecordEffectiveOn(record, dateText)) {
        events.push(toEvent(record, date));
      }
    }
  }

  return events.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if (a.recordType !== b.recordType) {
      return a.recordType === "income" ? -1 : 1;
    }
    return a.title.localeCompare(b.title, "zh-TW");
  });
}

export function getEventsForDate(records: CashRecord[], date: Date) {
  const dateText = toDateText(date);
  return buildMonthlyEvents(records, date).filter(
    (event) => event.dateText === dateText
  );
}

export function calculateMonthSummary(records: CashRecord[], baseDate: Date) {
  const events = buildMonthlyEvents(records, baseDate);
  const incomeEvents = events.filter((event) => event.recordType === "income");
  const expenseEvents = events.filter((event) => event.recordType === "expense");
  const fixedExpenseEvents = expenseEvents.filter(
    (event) => event.frequency !== "once"
  );
  const singleExpenseEvents = expenseEvents.filter(
    (event) => event.frequency === "once"
  );
  const income = sumAmounts(incomeEvents);
  const fixedExpense = sumAmounts(fixedExpenseEvents);
  const singleExpense = sumAmounts(singleExpenseEvents);

  return {
    events,
    income,
    fixedExpense,
    singleExpense,
    totalExpense: fixedExpense + singleExpense,
    balance: income - fixedExpense - singleExpense,
    fixedExpenseEvents,
    singleExpenseEvents,
  };
}

export function getFrequencyText(frequency: Frequency) {
  if (frequency === "once") return "單次";
  if (frequency === "monthly") return "每月固定";
  if (frequency === "weekly") return "每週固定";
  return "每年固定";
}

export function getRecordTypeText(recordType: RecordType) {
  return recordType === "expense" ? "支出" : "收入";
}

export function getCategoryIcon(category: string) {
  const icons: Record<string, string> = {
    飲食: "🍱",
    交通: "🚌",
    房租: "🏠",
    電信: "📱",
    訂閱: "📦",
    薪水: "💰",
    保險: "🛡️",
    學貸: "🎓",
  };
  return icons[category] ?? "📝";
}
