"use client";

import { useEffect, useMemo, useState } from "react";

type RecordType = "expense" | "income";
type Frequency = "once" | "monthly" | "weekly" | "yearly";

type CashRecord = {
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
};

type CalendarDay = {
  date: Date | null;
  dateText: string;
  dayNumber: number | null;
  records: CashRecord[];
};

const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

function formatMoney(value: number) {
  const absValue = Math.abs(value);
  const formatted = `$${absValue.toLocaleString("zh-TW")}`;

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatCalendarMoney(value: number) {
  const absValue = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";

  if (absValue >= 10000) {
    const wan = absValue / 10000;
    const displayValue = Number.isInteger(wan) ? wan.toString() : wan.toFixed(1);
    return `${sign}${displayValue}萬`;
  }

  if (absValue >= 1000) {
    const thousand = absValue / 1000;
    const displayValue = Number.isInteger(thousand)
      ? thousand.toString()
      : thousand.toFixed(1);

    return `${sign}${displayValue}k`;
  }

  return `${sign}${absValue}`;
}

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getWeekdayText(date: Date) {
  const weekday = date.getDay();

  if (weekday === 0) return "星期日";
  if (weekday === 1) return "星期一";
  if (weekday === 2) return "星期二";
  if (weekday === 3) return "星期三";
  if (weekday === 4) return "星期四";
  if (weekday === 5) return "星期五";

  return "星期六";
}

function getCategoryIcon(category: string) {
  if (category === "飲食") return "🍱";
  if (category === "交通") return "🚌";
  if (category === "房租") return "🏠";
  if (category === "電信") return "📱";
  if (category === "訂閱") return "📦";
  if (category === "薪水") return "💰";
  if (category === "保險") return "🛡️";
  if (category === "學貸") return "🎓";

  return "📝";
}

function getRecordsForDate(records: CashRecord[], date: Date) {
  const dateText = toDateText(date);
  const dayOfMonth = date.getDate();
  const monthOfYear = date.getMonth() + 1;
  const weekdayText = getWeekdayText(date);

  return records.filter((record) => {
    if (record.frequency === "once") {
      return record.date === dateText;
    }

    if (record.frequency === "monthly") {
      return Number(record.dayOfMonth) === dayOfMonth;
    }

    if (record.frequency === "weekly") {
      return record.dayOfWeek === weekdayText;
    }

    if (record.frequency === "yearly") {
      return (
        Number(record.monthOfYear) === monthOfYear &&
        Number(record.dayOfMonth) === dayOfMonth
      );
    }

    return false;
  });
}

function getDayTotal(records: CashRecord[]) {
  return records.reduce((sum, record) => {
    if (record.recordType === "income") {
      return sum + record.amount;
    }

    return sum - record.amount;
  }, 0);
}

function getMonthTitle(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function getRecordLabel(record: CashRecord) {
  if (record.frequency === "once") return "單次";
  if (record.frequency === "monthly") return "每月固定";
  if (record.frequency === "weekly") return "每週固定";
  if (record.frequency === "yearly") return "每年固定";

  return "";
}

export default function CalendarPage() {
  const [records, setRecords] = useState<CashRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDateText, setSelectedDateText] = useState(() =>
    toDateText(new Date())
  );

  useEffect(() => {
    const recordsText = localStorage.getItem("cashRecords");
    const savedRecords: CashRecord[] = recordsText
      ? JSON.parse(recordsText)
      : [];

    setRecords(savedRecords);
  }, []);

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: CalendarDay[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      days.push({
        date: null,
        dateText: "",
        dayNumber: null,
        records: [],
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateRecords = getRecordsForDate(records, date);

      days.push({
        date,
        dateText: toDateText(date),
        dayNumber: day,
        records: dateRecords,
      });
    }

    return days;
  }, [currentMonth, records]);

  const monthRecords = calendarDays.flatMap((day) => day.records);

  const monthIncome = monthRecords
    .filter((record) => record.recordType === "income")
    .reduce((sum, record) => sum + record.amount, 0);

  const monthExpense = monthRecords
    .filter((record) => record.recordType === "expense")
    .reduce((sum, record) => sum + record.amount, 0);

  const monthBalance = monthIncome - monthExpense;

  const selectedDay = calendarDays.find(
    (day) => day.dateText === selectedDateText
  );

  const selectedRecords = selectedDay?.records ?? [];
  const selectedDayTotal = getDayTotal(selectedRecords);

  function saveRecords(nextRecords: CashRecord[]) {
    setRecords(nextRecords);
    localStorage.setItem("cashRecords", JSON.stringify(nextRecords));
  }

  function handleDeleteRecord(recordId: string, recordTitle: string) {
    const confirmDelete = confirm(`確定要刪除「${recordTitle}」嗎？`);

    if (!confirmDelete) {
      return;
    }

    const nextRecords = records.filter((record) => record.id !== recordId);
    saveRecords(nextRecords);
  }

  function goPreviousMonth() {
    setCurrentMonth((oldDate) => {
      const nextDate = new Date(
        oldDate.getFullYear(),
        oldDate.getMonth() - 1,
        1
      );

      setSelectedDateText(toDateText(nextDate));
      return nextDate;
    });
  }

  function goNextMonth() {
    setCurrentMonth((oldDate) => {
      const nextDate = new Date(
        oldDate.getFullYear(),
        oldDate.getMonth() + 1,
        1
      );

      setSelectedDateText(toDateText(nextDate));
      return nextDate;
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-5">
        <header className="mb-4">
          <p className="text-xs text-slate-400">現金流月曆</p>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={goPreviousMonth}
              className="rounded-full bg-white/10 px-3 py-2 text-xs text-slate-200"
            >
              上月
            </button>

            <h1 className="text-xl font-black tracking-tight">
              {getMonthTitle(currentMonth)}
            </h1>

            <button
              type="button"
              onClick={goNextMonth}
              className="rounded-full bg-white/10 px-3 py-2 text-xs text-slate-200"
            >
              下月
            </button>
          </div>
        </header>

        <section className="mb-5 rounded-[2rem] bg-gradient-to-br from-sky-400 to-indigo-500 p-5 shadow-2xl">
          <p className="text-xs text-sky-100">本月預估結餘</p>

          <p className="mt-2 text-4xl font-black">
            {formatMoney(monthBalance)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-[11px] text-sky-100">收入</p>
              <p className="mt-1 text-sm font-bold text-emerald-100">
                {formatMoney(monthIncome)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-[11px] text-sky-100">支出</p>
              <p className="mt-1 text-sm font-bold text-rose-100">
                {formatMoney(monthExpense)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white/5 p-4 shadow-xl ring-1 ring-white/10">
          <div
            className="grid gap-1 text-center text-[11px] text-slate-400"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {weekLabels.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div
            className="mt-1 grid gap-1"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {calendarDays.map((day, index) => {
              if (day.date === null) {
                return <div key={`empty-${index}`} className="h-12" />;
              }

              const dayTotal = getDayTotal(day.records);
              const hasRecords = day.records.length > 0;
              const isSelected = day.dateText === selectedDateText;

              return (
                <button
                  key={day.dateText}
                  type="button"
                  onClick={() => setSelectedDateText(day.dateText)}
                  className={
                    isSelected
                      ? "h-12 overflow-hidden rounded-xl border border-sky-300 bg-sky-400/15 px-1.5 py-1 text-left shadow-[0_0_16px_rgba(56,189,248,0.25)]"
                      : hasRecords
                        ? "h-12 overflow-hidden rounded-xl bg-slate-800 px-1.5 py-1 text-left"
                        : "h-12 overflow-hidden rounded-xl bg-slate-950/40 px-1.5 py-1 text-left"
                  }
                >
                  <p
                    className={
                      isSelected
                        ? "text-[10px] font-black leading-none text-sky-100"
                        : "text-[10px] font-bold leading-none text-white"
                    }
                  >
                    {day.dayNumber}
                  </p>

                  {hasRecords && (
                    <p
                      className={
                        dayTotal >= 0
                          ? "mt-1 truncate text-[9px] font-black leading-none text-emerald-300"
                          : "mt-1 truncate text-[9px] font-black leading-none text-rose-300"
                      }
                    >
                      {formatCalendarMoney(dayTotal)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">當日明細</h2>
              <p className="text-sm text-slate-400">
                {selectedDateText || "尚未選擇日期"}
              </p>
            </div>

            <a
              href={`/add?date=${selectedDateText}`}
              className="rounded-full bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-300"
            >
              新增
            </a>
          </div>

          <div className="mb-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <p className="text-sm text-slate-400">當日合計</p>
            <p
              className={
                selectedDayTotal >= 0
                  ? "mt-1 text-2xl font-black text-emerald-300"
                  : "mt-1 text-2xl font-black text-rose-300"
              }
            >
              {formatMoney(selectedDayTotal)}
            </p>
          </div>

          {selectedRecords.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-5 text-center text-slate-400 ring-1 ring-white/10">
              這天沒有收支。
            </div>
          ) : (
            <div className="space-y-3">
              {selectedRecords.map((record) => (
                <div
                  key={`${selectedDateText}-${record.id}`}
                  className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-800">
                        {getCategoryIcon(record.category)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-bold">{record.title}</p>
                        <p className="text-sm text-slate-400">
                          {record.category}｜{getRecordLabel(record)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p
                        className={
                          record.recordType === "expense"
                            ? "font-bold text-rose-300"
                            : "font-bold text-emerald-300"
                        }
                      >
                        {record.recordType === "expense" ? "-" : "+"}
                        {formatMoney(record.amount)}
                      </p>

                      <div className="flex gap-2">
                        <a
                          href={`/add?editId=${record.id}`}
                          className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-300"
                        >
                          編輯
                        </a>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteRecord(record.id, record.title)
                          }
                          className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <nav className="sticky bottom-4 mt-6 rounded-full bg-white/10 p-2 backdrop-blur">
          <div className="grid grid-cols-4 text-center text-xs text-slate-300">
            <a href="/" className="py-3">
              首頁
            </a>

            <a
              href="/calendar"
              className="rounded-full bg-white py-3 font-bold text-slate-950"
            >
              月曆
            </a>

            <a href="/add" className="py-3">
              新增
            </a>

            <a href="/settings" className="py-3">
              設定
            </a>
          </div>
        </nav>
      </div>
    </main>
  );
}