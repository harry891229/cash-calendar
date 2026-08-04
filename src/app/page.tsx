"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { calculateBudgetStatus } from "@/lib/budget";
import { getCategoryIcon } from "@/lib/categories";
import { toDateText } from "@/lib/date";
import { formatMoney, getSignedAmount } from "@/lib/money";
import {
  calculateMonthSummary,
  getFrequencyText,
} from "@/lib/recurrence";
import { loadBudgetSettings } from "@/lib/settings-storage";
import { loadCashRecords, saveCashRecords } from "@/lib/storage";
import type { CashRecord } from "@/types/cash-record";

export default function Home() {
  const [records, setRecords] = useState<CashRecord[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecords(loadCashRecords().records);
      setMonthlyBudget(loadBudgetSettings().value.monthlyBudget);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const today = new Date();
  const todayText = toDateText(today);
  const summary = calculateMonthSummary(records, today);
  const budget = calculateBudgetStatus(records, today, monthlyBudget);
  const recentEvents = [...summary.events]
    .filter((event) => event.dateText <= todayText)
    .sort((a, b) => b.dateText.localeCompare(a.dateText))
    .slice(0, 5);

  function deleteRecord(recordId: string, title: string) {
    if (!confirm(`確定刪除「${title}」？`)) return;
    const next = records.filter((record) => record.id !== recordId);
    saveCashRecords(next);
    setRecords(next);
  }

  const progressWidth = budget.usagePercent === null
    ? 0
    : Math.min(Math.max(budget.usagePercent, 0), 100);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-6">
        <header className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400">{today.getFullYear()} 年 {today.getMonth() + 1} 月</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">記帳月曆</h1>
          </div>
          <Link href="/settings" className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200">設定</Link>
        </header>

        <section className="rounded-[2rem] bg-gradient-to-br from-sky-400 to-indigo-500 p-5 shadow-2xl">
          <p className="text-sm font-medium text-sky-100">本月剩餘可用金額</p>
          <p className="mt-2 text-5xl font-black tracking-tight">{formatMoney(summary.balance)}</p>
          <p className="mt-2 text-sm text-sky-100">收入扣除固定支出與單次支出</p>
        </section>

        <section className="mt-5 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold">本月預算</h2>
              <p className="mt-1 text-sm text-slate-400">
                {monthlyBudget === null ? "尚未設定" : formatMoney(monthlyBudget)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">本月已支出</p>
              <p className="font-black text-rose-300">{formatMoney(budget.totalExpense)}</p>
            </div>
          </div>

          {monthlyBudget === null ? (
            <Link href="/settings" className="mt-4 block rounded-2xl bg-sky-400/10 px-4 py-3 text-center text-sm font-bold text-sky-300">
              前往設定每月預算
            </Link>
          ) : (
            <>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800" aria-label={`預算已使用 ${budget.usagePercent}%`}>
                <div
                  className={budget.isOverBudget ? "h-full bg-red-400" : "h-full bg-sky-400"}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">剩餘預算</p>
                  <p className={budget.isOverBudget ? "text-xl font-black text-red-300" : "text-xl font-black text-emerald-300"}>
                    {formatMoney(budget.remainingBudget ?? 0)}
                  </p>
                </div>
                <p className="text-right text-sm font-bold text-slate-200">已使用 {budget.usagePercent}%</p>
              </div>
              {budget.isOverBudget ? (
                <p className="mt-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 ring-1 ring-red-400/30">
                  本月預算已超支 {formatMoney(Math.abs(budget.remainingBudget ?? 0))}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="mt-4 rounded-3xl bg-slate-800 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-bold">平均每日可花金額</h2>
              <p className="mt-1 text-xs text-slate-400">估算值・包含今天還有 {budget.remainingDays} 天</p>
            </div>
            <p className="text-2xl font-black text-sky-300">
              {budget.dailyAvailable === null ? "尚未設定預算" : formatMoney(budget.dailyAvailable)}
            </p>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/add" className="rounded-3xl bg-white px-4 py-4 text-left text-slate-950 shadow-lg">
            <p className="text-sm text-slate-500">快速操作</p>
            <p className="mt-1 text-lg font-bold">新增一筆支出</p>
          </Link>
          <Link href="/calendar" className="rounded-3xl bg-slate-800 px-4 py-4 text-left text-white shadow-lg">
            <p className="text-sm text-slate-400">查看明細</p>
            <p className="mt-1 text-lg font-bold">開啟月曆</p>
          </Link>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">本月收支摘要</h2>
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard label="收入" value={summary.income} color="text-emerald-300" />
            <SummaryCard label="固定支出" value={summary.fixedExpense} color="text-rose-300" />
            <SummaryCard label="單次支出" value={summary.singleExpense} color="text-amber-300" />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">最近記帳紀錄</h2>
            <Link href="/calendar" className="text-sm font-bold text-sky-300">查看全部</Link>
          </div>
          {recentEvents.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-5 text-center text-slate-400 ring-1 ring-white/10">本月尚無記帳紀錄</div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div key={event.id} className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-800">{getCategoryIcon(event.category)}</div>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{event.title}</p>
                        <p className="text-xs text-slate-400">{event.dateText}・{event.category}・{getFrequencyText(event.frequency)}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={event.recordType === "expense" ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>{formatMoney(getSignedAmount(event))}</p>
                      <div className="mt-2 flex gap-2">
                        <Link href={`/add?editId=${event.recordId}`} className="text-xs font-bold text-sky-300">編輯</Link>
                        <button type="button" onClick={() => deleteRecord(event.recordId, event.title)} className="text-xs font-bold text-red-300">刪除</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <BottomNav />
      </div>
    </main>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-black ${color}`}>{formatMoney(value)}</p>
    </div>
  );
}
