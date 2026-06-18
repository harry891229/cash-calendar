"use client";

import { useEffect, useState } from "react";

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

type CashEvent = {
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

function formatMoney(value: number) {
  const absValue = Math.abs(Math.round(value));
  const formatted = `$${absValue.toLocaleString("zh-TW")}`;

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function getSignedAmount(recordType: RecordType, amount: number) {
  if (recordType === "expense") {
    return -amount;
  }

  return amount;
}

function getFrequencyText(frequency: Frequency) {
  if (frequency === "once") return "單次";
  if (frequency === "monthly") return "每月固定";
  if (frequency === "weekly") return "每週固定";
  if (frequency === "yearly") return "每年固定";

  return "";
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

function isSameMonth(dateText: string, baseDate: Date) {
  if (!dateText) {
    return false;
  }

  const date = new Date(`${dateText}T00:00:00`);

  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth()
  );
}

function buildMonthlyEvents(records: CashRecord[], baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const events: CashEvent[] = [];

  records.forEach((record) => {
    if (record.frequency === "once") {
      if (!isSameMonth(record.date, baseDate)) {
        return;
      }

      const date = new Date(`${record.date}T00:00:00`);

      events.push({
        id: `${record.id}-${record.date}`,
        recordId: record.id,
        title: record.title,
        amount: record.amount,
        recordType: record.recordType,
        frequency: record.frequency,
        category: record.category,
        dateText: record.date,
        day: date.getDate(),
      });

      return;
    }

    if (record.frequency === "monthly") {
      const day = Number(record.dayOfMonth);

      if (!day || day < 1 || day > lastDay) {
        return;
      }

      const date = new Date(year, month, day);

      events.push({
        id: `${record.id}-${toDateText(date)}`,
        recordId: record.id,
        title: record.title,
        amount: record.amount,
        recordType: record.recordType,
        frequency: record.frequency,
        category: record.category,
        dateText: toDateText(date),
        day,
      });

      return;
    }

    if (record.frequency === "weekly") {
      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);

        if (getWeekdayText(date) === record.dayOfWeek) {
          events.push({
            id: `${record.id}-${toDateText(date)}`,
            recordId: record.id,
            title: record.title,
            amount: record.amount,
            recordType: record.recordType,
            frequency: record.frequency,
            category: record.category,
            dateText: toDateText(date),
            day,
          });
        }
      }

      return;
    }

    if (record.frequency === "yearly") {
      const targetMonth = Number(record.monthOfYear);
      const targetDay = Number(record.dayOfMonth);

      if (targetMonth !== month + 1) {
        return;
      }

      if (!targetDay || targetDay < 1 || targetDay > lastDay) {
        return;
      }

      const date = new Date(year, month, targetDay);

      events.push({
        id: `${record.id}-${toDateText(date)}`,
        recordId: record.id,
        title: record.title,
        amount: record.amount,
        recordType: record.recordType,
        frequency: record.frequency,
        category: record.category,
        dateText: toDateText(date),
        day: targetDay,
      });
    }
  });

  return events.sort((a, b) => {
    if (a.day !== b.day) {
      return a.day - b.day;
    }

    if (a.recordType !== b.recordType) {
      return a.recordType === "income" ? -1 : 1;
    }

    return a.title.localeCompare(b.title, "zh-TW");
  });
}

export default function Home() {
  const [records, setRecords] = useState<CashRecord[]>([]);

  useEffect(() => {
    const recordsText = localStorage.getItem("cashRecords");
    const savedRecords: CashRecord[] = recordsText
      ? JSON.parse(recordsText)
      : [];

    setRecords(savedRecords);
  }, []);

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

  function handleClearAll() {
    const confirmClear = confirm("確定要清除目前所有測試資料嗎？");

    if (!confirmClear) {
      return;
    }

    localStorage.removeItem("cashRecords");
    setRecords([]);
  }

  const today = new Date();
  const todayText = toDateText(today);

  const currentMonthTitle = `${today.getFullYear()} 年 ${
    today.getMonth() + 1
  } 月`;

  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();

  const remainingDays = daysInMonth - today.getDate() + 1;

  const monthEvents = buildMonthlyEvents(records, today);

  const monthIncome = monthEvents
    .filter((event) => event.recordType === "income")
    .reduce((sum, event) => sum + event.amount, 0);

  const fixedExpense = monthEvents
    .filter(
      (event) => event.recordType === "expense" && event.frequency !== "once"
    )
    .reduce((sum, event) => sum + event.amount, 0);

  const plannedSingleExpense = monthEvents
    .filter(
      (event) => event.recordType === "expense" && event.frequency === "once"
    )
    .reduce((sum, event) => sum + event.amount, 0);

  const remainingFunMoney = monthIncome - fixedExpense - plannedSingleExpense;

  const dailyCanSpend =
    remainingDays > 0 ? Math.floor(remainingFunMoney / remainingDays) : 0;

  const fixedExpenseEvents = monthEvents.filter(
    (event) => event.recordType === "expense" && event.frequency !== "once"
  );

  const singleExpenseEvents = monthEvents.filter(
    (event) => event.recordType === "expense" && event.frequency === "once"
  );

  const upcomingEvents = monthEvents
    .filter((event) => event.dateText >= todayText)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400">目前資料存在此瀏覽器</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              現金流月曆
            </h1>
          </div>

          <a
            href="/settings"
            className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200"
          >
            設定
          </a>
        </header>

        <section className="rounded-[2rem] bg-gradient-to-br from-sky-400 to-indigo-500 p-5 shadow-2xl">
          <p className="text-sm text-sky-100">{currentMonthTitle}</p>
          <p className="mt-1 text-sm text-sky-100">本月剩餘閒錢</p>

          <div className="mt-3">
            <p className="text-5xl font-black tracking-tight">
              {formatMoney(remainingFunMoney)}
            </p>

            <p className="mt-2 text-sm text-sky-100">
              已先扣除固定支出與本月已排定支出。
            </p>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          <a
            href="/add"
            className="rounded-3xl bg-white px-4 py-4 text-left text-slate-950 shadow-lg"
          >
            <p className="text-sm text-slate-500">快速新增</p>
            <p className="mt-1 text-lg font-bold">記一筆收支</p>
          </a>

          <a
            href="/add?frequency=monthly&recordType=expense"
            className="rounded-3xl bg-slate-800 px-4 py-4 text-left text-white shadow-lg"
          >
            <p className="text-sm text-slate-400">固定規則</p>
            <p className="mt-1 text-lg font-bold">新增固定收支</p>
          </a>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">本月摘要</h2>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm text-slate-400"
            >
              清除測試資料
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">本月收入</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">
                {formatMoney(monthIncome)}
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">固定支出</p>
              <p className="mt-2 text-2xl font-bold text-rose-300">
                {formatMoney(fixedExpense)}
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">本月已排定支出</p>
              <p className="mt-2 text-2xl font-bold text-amber-300">
                {formatMoney(plannedSingleExpense)}
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">每日可花</p>

              <p
                className={
                  dailyCanSpend >= 0
                    ? "mt-2 text-2xl font-bold text-sky-300"
                    : "mt-2 text-2xl font-bold text-red-300"
                }
              >
                {formatMoney(dailyCanSpend)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                剩餘 {remainingDays} 天平均
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">近期現金流</h2>
              <p className="text-sm text-slate-400">
                從今天開始，最多顯示 5 筆
              </p>
            </div>

            <a href="/calendar" className="text-sm font-medium text-sky-300">
              看月曆
            </a>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-5 text-center text-slate-400 ring-1 ring-white/10">
              本月接下來沒有排定的金流。
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const signedAmount = getSignedAmount(
                  event.recordType,
                  event.amount
                );

                return (
                  <div
                    key={event.id}
                    className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-800">
                          {getCategoryIcon(event.category)}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-bold">{event.title}</p>
                          <p className="text-sm text-slate-400">
                            {event.dateText}｜{event.category}｜
                            {getFrequencyText(event.frequency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p
                          className={
                            event.recordType === "expense"
                              ? "font-bold text-rose-300"
                              : "font-bold text-emerald-300"
                          }
                        >
                          {formatMoney(signedAmount)}
                        </p>

                        <div className="flex gap-2">
                          <a
                            href={`/add?editId=${event.recordId}`}
                            className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-300"
                          >
                            編輯
                          </a>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteRecord(event.recordId, event.title)
                            }
                            className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300"
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">固定支出摘要</h2>
              <p className="text-sm text-slate-400">不全部展開，避免首頁太長</p>
            </div>

            <a href="/settings" className="text-sm font-medium text-sky-300">
              管理
            </a>
          </div>

          <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">本月固定支出</p>
                <p className="mt-1 text-sm text-slate-400">
                  共 {fixedExpenseEvents.length} 筆固定支出
                </p>
              </div>

              <p className="text-2xl font-black text-rose-300">
                {formatMoney(fixedExpense)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">本月單次支出</h2>
              <p className="text-sm text-slate-400">你手動記錄或預排的花費</p>
            </div>

            <a href="/settings" className="text-sm font-medium text-sky-300">
              查看
            </a>
          </div>

          <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">已排定單次支出</p>
                <p className="mt-1 text-sm text-slate-400">
                  共 {singleExpenseEvents.length} 筆
                </p>
              </div>

              <p className="text-2xl font-black text-amber-300">
                {formatMoney(plannedSingleExpense)}
              </p>
            </div>
          </div>
        </section>

        <nav className="sticky bottom-4 mt-6 rounded-full bg-white/10 p-2 backdrop-blur">
          <div className="grid grid-cols-4 text-center text-xs text-slate-300">
            <a
              href="/"
              className="rounded-full bg-white py-3 font-bold text-slate-950"
            >
              首頁
            </a>

            <a href="/calendar" className="py-3">
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