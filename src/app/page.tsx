"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { calculateBudgetStatus } from "@/lib/budget";
import { getCategoryIcon } from "@/lib/categories";
import { toDateText } from "@/lib/date";
import { formatMoney, getSignedAmount } from "@/lib/money";
import { calculateMonthSummary, getFrequencyText } from "@/lib/recurrence";
import { stopRecurringRule } from "@/lib/recurring-rules";
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
    const target = records.find((record) => record.id === recordId);
    if (target && target.frequency !== "once") {
      if (target.effectiveTo !== null) {
        alert("此固定規則版本已停止，歷史紀錄會保留。");
        return;
      }
      if (!confirm(`確定停止「${title}」嗎？歷史紀錄會保留。`)) return;
      const next = stopRecurringRule(records, recordId, new Date());
      saveCashRecords(next);
      setRecords(next);
      return;
    }
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
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-5">
        <header className="mb-4 text-center">
          <h1 className="text-xl font-bold tracking-wide">{today.getFullYear()} 年 {today.getMonth() + 1} 月</h1>
        </header>

        <section className="rounded-[2rem] bg-gradient-to-br from-sky-400 to-indigo-500 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-sky-100">本月剩餘可用金額</h2>
            <Link href="/add?recordType=expense" className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 text-xs font-bold ring-1 ring-white/20">
              <span aria-hidden="true">＋</span>新增支出
            </Link>
          </div>
          <p className="mt-1 break-all text-4xl font-black tracking-tight">{formatMoney(summary.balance)}</p>
          <p className="mt-2 text-xs text-sky-100">收入扣除固定支出與單次支出</p>
        </section>

        <section className="mt-4 flex h-48 flex-col rounded-3xl bg-white/5 p-4 ring-1 ring-white/10" aria-label="本月預算">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">本月預算</h2>
            <p className="text-sm font-bold">{monthlyBudget === null ? "尚未設定" : formatMoney(monthlyBudget)}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <p className="text-slate-400">已支出 <span className="ml-1 font-bold text-rose-300">{formatMoney(budget.totalExpense)}</span></p>
            <p className="text-right text-slate-400">剩餘 <span className={`ml-1 font-bold ${budget.isOverBudget ? "text-red-300" : "text-emerald-300"}`}>{budget.remainingBudget === null ? "—" : formatMoney(budget.remainingBudget)}</span></p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="預算使用進度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressWidth} aria-valuetext={budget.usagePercent === null ? "尚未設定預算" : `已使用 ${budget.usagePercent}%`}>
              <div className={budget.isOverBudget ? "h-full bg-red-400" : "h-full bg-sky-400"} style={{ width: `${progressWidth}%` }} />
            </div>
            <p className="min-w-10 text-right text-xs font-bold text-slate-300">{budget.usagePercent === null ? "—" : `${budget.usagePercent}%`}</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <h3 className="text-sm font-bold">平均每日可花</h3>
            <p className="text-xl font-black text-sky-300">{budget.dailyAvailable === null ? "—" : formatMoney(budget.dailyAvailable)}</p>
          </div>
          <div className="mt-auto text-xs leading-4">
            {monthlyBudget === null ? (
              <Link href="/settings" className="font-bold text-sky-300">設定每月預算 ›</Link>
            ) : budget.isOverBudget ? (
              <p className="font-bold text-red-300">已超支 {formatMoney(Math.abs(budget.remainingBudget ?? 0))}</p>
            ) : (
              <p className="text-slate-400">估算值・包含今天還有 {budget.remainingDays} 天</p>
            )}
          </div>
        </section>

        <section className="mt-5" aria-label="本月收支摘要">
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
                        <button type="button" onClick={() => deleteRecord(event.recordId, event.title)} className="text-xs font-bold text-red-300">{event.frequency === "once" ? "刪除" : "停止"}</button>
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
      <p className={`mt-2 break-all text-sm font-black ${color}`}>{formatMoney(value)}</p>
    </div>
  );
}
