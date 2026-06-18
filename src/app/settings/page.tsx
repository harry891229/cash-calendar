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

function formatMoney(value: number) {
  const absValue = Math.abs(value);
  const formatted = `$${absValue.toLocaleString("zh-TW")}`;

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function getSignedAmount(record: CashRecord) {
  if (record.recordType === "expense") {
    return -record.amount;
  }

  return record.amount;
}

function getRecordTypeText(recordType: RecordType) {
  if (recordType === "expense") {
    return "支出";
  }

  return "收入";
}

function getFrequencyText(record: CashRecord) {
  if (record.frequency === "once") {
    return record.date || "單次";
  }

  if (record.frequency === "monthly") {
    return `每月 ${record.dayOfMonth} 號`;
  }

  if (record.frequency === "weekly") {
    return `每週${record.dayOfWeek.replace("星期", "")}`;
  }

  if (record.frequency === "yearly") {
    return `每年 ${record.monthOfYear} 月 ${record.dayOfMonth} 號`;
  }

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

export default function SettingsPage() {
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
    const confirmClear = confirm(
      "確定要清除所有資料嗎？這會刪掉目前瀏覽器裡的測試資料。"
    );

    if (!confirmClear) {
      return;
    }

    localStorage.removeItem("cashRecords");
    setRecords([]);

    alert("已清除所有資料");
  }

  function handleExportJson() {
    const dataText = JSON.stringify(records, null, 2);

    if (records.length === 0) {
      alert("目前沒有資料可以匯出");
      return;
    }

    navigator.clipboard.writeText(dataText);
    alert("資料已複製成 JSON，可先貼到記事本備份");
  }

  const incomeRecords = records.filter(
    (record) => record.recordType === "income"
  );

  const expenseRecords = records.filter(
    (record) => record.recordType === "expense"
  );

  const totalIncome = incomeRecords.reduce(
    (sum, record) => sum + record.amount,
    0
  );

  const totalExpense = expenseRecords.reduce(
    (sum, record) => sum + record.amount,
    0
  );

  const balance = totalIncome - totalExpense;

  const onceRecords = records.filter((record) => record.frequency === "once");

  const monthlyRecords = records.filter(
    (record) => record.frequency === "monthly"
  );

  const weeklyRecords = records.filter(
    (record) => record.frequency === "weekly"
  );

  const yearlyRecords = records.filter(
    (record) => record.frequency === "yearly"
  );

  const fixedRecords = records.filter((record) => record.frequency !== "once");

  function renderRecordCard(record: CashRecord) {
    const signedAmount = getSignedAmount(record);

    return (
      <div
        key={record.id}
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
                {getFrequencyText(record)}｜{record.category}｜
                {getRecordTypeText(record.recordType)}
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
              {formatMoney(signedAmount)}
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
                onClick={() => handleDeleteRecord(record.id, record.title)}
                className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-5">
        <header className="mb-6">
          <p className="text-sm text-slate-400">設定與資料管理</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">設定</h1>
        </header>

        <section className="rounded-[2rem] bg-gradient-to-br from-sky-400 to-indigo-500 p-5 shadow-2xl">
          <p className="text-sm text-sky-100">目前試算餘額</p>

          <p className="mt-2 text-4xl font-black">{formatMoney(balance)}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-xs text-sky-100">收入合計</p>
              <p className="mt-1 font-bold text-emerald-100">
                {formatMoney(totalIncome)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-xs text-sky-100">支出合計</p>
              <p className="mt-1 font-bold text-rose-100">
                {formatMoney(totalExpense)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">資料狀態</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">總筆數</p>
              <p className="mt-2 text-2xl font-black text-sky-300">
                {records.length}
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">收入筆數</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">
                {incomeRecords.length}
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">支出筆數</p>
              <p className="mt-2 text-2xl font-black text-rose-300">
                {expenseRecords.length}
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">儲存位置</p>
              <p className="mt-2 text-sm font-bold text-slate-200">
                瀏覽器 localStorage
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">週期統計</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <div>
                <p className="font-bold">單次收支</p>
                <p className="text-sm text-slate-400">只發生一次的資料</p>
              </div>
              <p className="text-xl font-black text-slate-200">
                {onceRecords.length}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <div>
                <p className="font-bold">每月固定</p>
                <p className="text-sm text-slate-400">例如房租、電話費、薪水</p>
              </div>
              <p className="text-xl font-black text-slate-200">
                {monthlyRecords.length}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <div>
                <p className="font-bold">每週固定</p>
                <p className="text-sm text-slate-400">例如每週課程、固定交通</p>
              </div>
              <p className="text-xl font-black text-slate-200">
                {weeklyRecords.length}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
              <div>
                <p className="font-bold">每年固定</p>
                <p className="text-sm text-slate-400">例如保險、年費</p>
              </div>
              <p className="text-xl font-black text-slate-200">
                {yearlyRecords.length}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">固定規則管理</h2>
              <p className="text-sm text-slate-400">
                每月、每週、每年固定出現的資料
              </p>
            </div>

            <a href="/add" className="text-sm text-sky-300">
              新增
            </a>
          </div>

          {fixedRecords.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-5 text-center text-slate-400 ring-1 ring-white/10">
              目前沒有固定規則。可以先新增薪水、房租或電話費。
            </div>
          ) : (
            <div className="space-y-3">
              {fixedRecords.map((record) => renderRecordCard(record))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-lg font-bold">單次資料管理</h2>
            <p className="text-sm text-slate-400">只發生一次的收入或支出</p>
          </div>

          {onceRecords.length === 0 ? (
            <div className="rounded-3xl bg-white/5 p-5 text-center text-slate-400 ring-1 ring-white/10">
              目前沒有單次資料。
            </div>
          ) : (
            <div className="space-y-3">
              {onceRecords.map((record) => renderRecordCard(record))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">資料操作</h2>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleExportJson}
              className="w-full rounded-3xl bg-slate-800 p-4 text-left ring-1 ring-white/10"
            >
              <p className="font-bold">匯出測試資料</p>
              <p className="mt-1 text-sm text-slate-400">
                先複製成 JSON，之後可以用來備份或轉移到資料庫
              </p>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="w-full rounded-3xl bg-red-500/10 p-4 text-left ring-1 ring-red-400/20"
            >
              <p className="font-bold text-red-300">清除全部資料</p>
              <p className="mt-1 text-sm text-red-200/70">
                只會清除目前瀏覽器裡的測試資料
              </p>
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <p className="font-bold">目前版本</p>
          <p className="mt-1 text-sm text-slate-400">
            這版資料還沒有上雲端，只存在你目前這個瀏覽器。之後接
            Supabase 後，才會變成登入帳號後跨裝置同步。
          </p>
        </section>

        <nav className="sticky bottom-4 mt-6 rounded-full bg-white/10 p-2 backdrop-blur">
          <div className="grid grid-cols-4 text-center text-xs text-slate-300">
            <a href="/" className="py-3">
              首頁
            </a>

            <a href="/calendar" className="py-3">
              月曆
            </a>

            <a href="/add" className="py-3">
              新增
            </a>

            <a
              href="/settings"
              className="rounded-full bg-white py-3 font-bold text-slate-950"
            >
              設定
            </a>
          </div>
        </nav>
      </div>
    </main>
  );
}