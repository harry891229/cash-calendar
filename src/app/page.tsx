"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { toDateText } from "@/lib/date";
import { formatMoney, getSignedAmount } from "@/lib/money";
import {
  calculateMonthSummary,
  getCategoryIcon,
  getFrequencyText,
} from "@/lib/recurrence";
import {
  clearCashRecordsSafely,
  loadCashRecords,
  saveCashRecords,
} from "@/lib/storage";
import type { CashRecord } from "@/types/cash-record";

export default function Home() {
  const [records, setRecords] = useState<CashRecord[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecords(loadCashRecords().records);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function saveRecords(nextRecords: CashRecord[]) {
    setRecords(nextRecords);
    saveCashRecords(nextRecords);
  }

  function handleDeleteRecord(recordId: string, recordTitle: string) {
    const target = records.find((record) => record.id === recordId);
    if (target && target.frequency !== "once") {
      const effectiveTo =
        todayText < target.effectiveFrom ? target.effectiveFrom : todayText;
      if (!confirm(`確定停止「${recordTitle}」嗎？過去紀錄會保留。`)) return;
      saveRecords(
        records.map((record) =>
          record.id === recordId ? { ...record, effectiveTo } : record
        )
      );
      return;
    }

    const confirmDelete = confirm(`確定要刪除「${recordTitle}」嗎？`);

    if (!confirmDelete) {
      return;
    }

    const nextRecords = records.filter((record) => record.id !== recordId);
    saveRecords(nextRecords);
  }

  function handleClearAll() {
    const confirmClear = confirm("確定要清除全部記帳資料嗎？");

    if (!confirmClear) {
      return;
    }

    if (!confirm("再次確認：這會清除全部記帳資料，確定繼續嗎？")) return;
    clearCashRecordsSafely();
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

  const summary = calculateMonthSummary(records, today);
  const monthEvents = summary.events;
  const monthIncome = summary.income;
  const fixedExpense = summary.fixedExpense;
  const plannedSingleExpense = summary.singleExpense;
  const remainingFunMoney = summary.balance;

  const dailyCanSpend =
    remainingDays > 0 ? Math.floor(remainingFunMoney / remainingDays) : 0;

  const fixedExpenseEvents = summary.fixedExpenseEvents;
  const singleExpenseEvents = summary.singleExpenseEvents;

  const upcomingEvents = monthEvents
    .filter((event) => event.dateText >= todayText)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-6">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400">目前資料存在此瀏覽器</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              現金流月曆
            </h1>
          </div>

          <Link
            href="/settings"
            className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200"
          >
            設定
          </Link>
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
          <Link
            href="/add"
            className="rounded-3xl bg-white px-4 py-4 text-left text-slate-950 shadow-lg"
          >
            <p className="text-sm text-slate-500">快速新增</p>
            <p className="mt-1 text-lg font-bold">記一筆收支</p>
          </Link>

          <Link
            href="/add?frequency=monthly&recordType=expense"
            className="rounded-3xl bg-slate-800 px-4 py-4 text-left text-white shadow-lg"
          >
            <p className="text-sm text-slate-400">固定規則</p>
            <p className="mt-1 text-lg font-bold">新增固定收支</p>
          </Link>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">本月摘要</h2>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm text-slate-400"
            >
              清除全部記帳資料
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

            <Link href="/calendar" className="text-sm font-medium text-sky-300">
              看月曆
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-5 text-center text-slate-400 ring-1 ring-white/10">
              本月接下來沒有排定的金流。
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const signedAmount = getSignedAmount(event);

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
                          <Link
                            href={`/add?editId=${event.recordId}`}
                            className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-300"
                          >
                            編輯
                          </Link>

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

            <Link href="/settings" className="text-sm font-medium text-sky-300">
              管理
            </Link>
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

            <Link href="/settings" className="text-sm font-medium text-sky-300">
              查看
            </Link>
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

        <BottomNav />
      </div>
    </main>
  );
}
