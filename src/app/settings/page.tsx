"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import {
  createCashCalendarBackup,
  getBackupFilename,
} from "@/lib/backup";
import { toDateText } from "@/lib/date";
import { formatMoney, getSignedAmount } from "@/lib/money";
import {
  calculateMonthSummary,
  getCategoryIcon,
  getRecordTypeText,
  isRecurringRecord,
} from "@/lib/recurrence";
import {
  clearCashRecordsSafely,
  getQuarantinedRecords,
  loadCashRecords,
  previewCashRecordsImport,
  restoreCashRecordsFromText,
  saveCashRecords,
  type CashRecordsImportPreview,
} from "@/lib/storage";
import type { CashRecord } from "@/types/cash-record";

function getFrequencyText(record: CashRecord) {
  if (record.frequency === "once") {
    return record.date || "單次";
  }

  const activeRange = `${record.effectiveFrom} 起${
    record.effectiveTo ? `，至 ${record.effectiveTo}` : ""
  }`;

  if (record.frequency === "monthly") {
    return `每月 ${record.dayOfMonth} 號｜${activeRange}`;
  }

  if (record.frequency === "weekly") {
    return `每週${record.dayOfWeek.replace("星期", "")}｜${activeRange}`;
  }

  if (record.frequency === "yearly") {
    return `每年 ${record.monthOfYear} 月 ${record.dayOfMonth} 號｜${activeRange}`;
  }

  return "";
}

export default function SettingsPage() {
  const [records, setRecords] = useState<CashRecord[]>([]);
  const [storageWarning, setStorageWarning] = useState("");
  const [operationMessage, setOperationMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [pendingImport, setPendingImport] = useState<{
    raw: string;
    preview: CashRecordsImportPreview;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = loadCashRecords();
      setRecords(result.records);
      const quarantineCount = getQuarantinedRecords().length;
      if (quarantineCount > 0) {
        setStorageWarning(
          `目前有 ${quarantineCount} 筆不合法資料已隔離；正式備份檔不包含隔離資料。`
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function saveRecords(nextRecords: CashRecord[]) {
    setRecords(nextRecords);
    saveCashRecords(nextRecords);
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
      "確定要清除所有資料嗎？這會刪掉目前瀏覽器裡的全部記帳資料。"
    );

    if (!confirmClear) {
      return;
    }

    const confirmAgain = confirm(
      "再次確認：清除後只能從先前匯出的備份還原，確定繼續嗎？"
    );
    if (!confirmAgain) return;

    clearCashRecordsSafely();
    setRecords([]);
    alert("已清除所有資料");
  }

  function handleStopRecord(record: CashRecord) {
    const todayText = toDateText(new Date());
    const effectiveTo =
      todayText < record.effectiveFrom ? record.effectiveFrom : todayText;
    if (!confirm(`確定讓「${record.title}」於 ${effectiveTo} 停止生效嗎？`)) {
      return;
    }

    saveRecords(
      records.map((item) =>
        item.id === record.id ? { ...item, effectiveTo } : item
      )
    );
  }

  function handleDownloadBackup() {
    const verifiedRecords = loadCashRecords().records;
    const backup = createCashCalendarBackup(verifiedRecords);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getBackupFilename();
    link.click();
    URL.revokeObjectURL(url);

    const quarantineCount = getQuarantinedRecords().length;
    setOperationMessage(
      quarantineCount > 0
        ? `備份已下載；${quarantineCount} 筆隔離資料未包含在檔案中。`
        : "備份檔已下載。"
    );
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportError("");
    setOperationMessage("");
    setPendingImport(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportError("僅接受副檔名為 .json 的備份檔。現有資料未變更。");
      return;
    }

    try {
      const raw = await file.text();
      const inspected = previewCashRecordsImport(raw);
      if (!inspected.ok) {
        setImportError(`${inspected.error} 現有資料未變更。`);
        return;
      }
      setPendingImport({ raw, preview: inspected.preview });
    } catch {
      setImportError("無法讀取備份檔。現有資料未變更。");
    }
  }

  function handleConfirmImport() {
    if (!pendingImport) return;
    const confirmed = confirm(
      `匯入會完整取代目前 ${records.length} 筆資料。系統會先自動備份現有 cashRecords，確定繼續嗎？`
    );
    if (!confirmed) return;

    const restored = restoreCashRecordsFromText(pendingImport.raw);
    if (!restored.ok) {
      setImportError(`${restored.error} 現有資料未變更。`);
      return;
    }

    const latest = loadCashRecords();
    setRecords(latest.records);
    setPendingImport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const invalidText = restored.preview.quarantined.length
      ? `，另有 ${restored.preview.quarantined.length} 筆無效紀錄已隔離`
      : "";
    setOperationMessage(
      `已完整還原 ${latest.records.length} 筆紀錄${invalidText}。匯入前資料已自動備份。`
    );
  }

  const incomeRecords = records.filter(
    (record) => record.recordType === "income"
  );

  const expenseRecords = records.filter(
    (record) => record.recordType === "expense"
  );

  const monthSummary = calculateMonthSummary(records, new Date());
  const totalIncome = monthSummary.income;
  const totalExpense = monthSummary.totalExpense;
  const balance = monthSummary.balance;

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

  const fixedRecords = records.filter(isRecurringRecord);

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
              {isRecurringRecord(record) && record.effectiveTo === null ? (
                <button
                  type="button"
                  onClick={() => handleStopRecord(record)}
                  className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300"
                >
                  停止
                </button>
              ) : null}
              <Link
                href={`/add?editId=${record.id}`}
                className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-300"
              >
                編輯
              </Link>

              {!isRecurringRecord(record) ? (
                <button
                  type="button"
                  onClick={() => handleDeleteRecord(record.id, record.title)}
                  className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300"
                >
                  刪除
                </button>
              ) : null}
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

        {storageWarning ? (
          <section className="mb-5 rounded-3xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/30">
            {storageWarning}
          </section>
        ) : null}

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

            <Link href="/add" className="text-sm text-sky-300">
              新增
            </Link>
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
          <h2 className="mb-1 text-lg font-bold">資料備份與還原</h2>
          <p className="mb-3 text-sm text-slate-400">
            匯入預設會完整取代目前資料，執行前會先自動備份。
          </p>

          {operationMessage ? (
            <p
              role="status"
              className="mb-3 rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-200 ring-1 ring-emerald-400/30"
            >
              {operationMessage}
            </p>
          ) : null}

          {importError ? (
            <p
              role="alert"
              className="mb-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/30"
            >
              {importError}
            </p>
          ) : null}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full rounded-3xl bg-slate-800 p-4 text-left ring-1 ring-white/10"
            >
              <p className="font-bold">下載備份檔</p>
              <p className="mt-1 text-sm text-slate-400">
                下載含 schema version、建立時間與已驗證紀錄的 JSON
              </p>
            </button>

            <label className="block rounded-3xl bg-slate-800 p-4 ring-1 ring-white/10">
              <span className="font-bold">匯入備份</span>
              <span className="mt-1 block text-sm text-slate-400">
                選檔後只會先驗證並顯示摘要，不會立即覆寫
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="mt-3 block w-full text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
              />
            </label>

            {pendingImport ? (
              <div className="rounded-3xl bg-sky-400/10 p-4 ring-1 ring-sky-400/30">
                <p className="font-bold text-sky-200">匯入摘要</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-slate-400">紀錄總數</dt><dd>{pendingImport.preview.records.length}</dd></div>
                  <div><dt className="text-slate-400">收入筆數</dt><dd>{pendingImport.preview.records.filter((item) => item.recordType === "income").length}</dd></div>
                  <div><dt className="text-slate-400">支出筆數</dt><dd>{pendingImport.preview.records.filter((item) => item.recordType === "expense").length}</dd></div>
                  <div><dt className="text-slate-400">固定規則</dt><dd>{pendingImport.preview.records.filter(isRecurringRecord).length}</dd></div>
                  <div><dt className="text-slate-400">無效紀錄</dt><dd>{pendingImport.preview.quarantined.length}</dd></div>
                  <div><dt className="text-slate-400">格式</dt><dd>{pendingImport.preview.sourceFormat === "legacy" ? "舊陣列格式" : "v2"}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-slate-400">
                  備份建立時間：{pendingImport.preview.exportedAt ?? "舊格式未提供"}
                </p>
                <p className="mt-2 text-xs font-bold text-amber-200">
                  確認後會完整取代現有資料；無效紀錄會隔離，不會寫入正式紀錄。
                </p>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="mt-4 w-full rounded-2xl bg-sky-400 px-4 py-3 font-black text-slate-950"
                >
                  確認完整取代並還原
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleClearAll}
              className="w-full rounded-3xl bg-red-500/10 p-4 text-left ring-1 ring-red-400/20"
            >
              <p className="font-bold text-red-300">清除全部資料</p>
              <p className="mt-1 text-sm text-red-200/70">
                只會清除目前瀏覽器裡的全部記帳資料
              </p>
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
          <p className="font-bold">目前版本</p>
          <p className="mt-1 text-sm text-slate-400">
            資料只存在目前瀏覽器，可安裝成 App 並離線使用。請定期下載
            JSON 備份，避免清除瀏覽器資料後無法還原。
          </p>
        </section>

        <BottomNav />
      </div>
    </main>
  );
}
