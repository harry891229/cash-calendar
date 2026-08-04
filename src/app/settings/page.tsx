"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "@/components/BottomNav";
import {
  addCustomCategory,
  renameCustomCategory,
  setCategoryDisabled,
} from "@/lib/categories";
import { createCashCalendarBackup, getBackupFilename } from "@/lib/backup";
import { toDateText } from "@/lib/date";
import { formatMoney, parsePositiveNtd } from "@/lib/money";
import {
  loadBudgetSettings,
  loadCategorySettings,
  saveBudgetSettings,
  saveCategorySettings,
} from "@/lib/settings-storage";
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
import type { BudgetSettings, CategorySettings } from "@/types/settings";

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<CashRecord[]>([]);
  const [budget, setBudget] = useState<BudgetSettings>({ version: 1, monthlyBudget: null });
  const [budgetInput, setBudgetInput] = useState("");
  const [categories, setCategories] = useState<CategorySettings | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [quarantineCount, setQuarantineCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importRaw, setImportRaw] = useState("");
  const [importPreview, setImportPreview] = useState<CashRecordsImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState("");

  function refresh() {
    const loadedRecords = loadCashRecords().records;
    const loadedBudget = loadBudgetSettings().value;
    const loadedCategories = loadCategorySettings().value;
    setRecords(loadedRecords);
    setBudget(loadedBudget);
    setBudgetInput(loadedBudget.monthlyBudget === null ? "" : String(loadedBudget.monthlyBudget));
    setCategories(loadedCategories);
    setQuarantineCount(getQuarantinedRecords().length);
  }

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function showSuccess(value: string) {
    setError("");
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3000);
  }

  function saveBudget() {
    const amount = parsePositiveNtd(budgetInput);
    if (amount === null) {
      setError("預算必須是新臺幣安全正整數，不接受小數或科學記號。");
      return;
    }
    const next: BudgetSettings = { version: 1, monthlyBudget: amount };
    saveBudgetSettings(next);
    setBudget(next);
    showSuccess("每月預算已儲存");
  }

  function clearBudget() {
    const next: BudgetSettings = { version: 1, monthlyBudget: null };
    saveBudgetSettings(next);
    setBudget(next);
    setBudgetInput("");
    showSuccess("每月預算已取消");
  }

  function updateCategories(next: CategorySettings, success: string) {
    saveCategorySettings(next);
    setCategories(next);
    showSuccess(success);
  }

  function addCategory() {
    if (!categories) return;
    try {
      const next = addCustomCategory(categories, newCategory);
      updateCategories(next, "自訂分類已新增");
      setNewCategory("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法新增分類");
    }
  }

  function saveRename() {
    if (!categories || !editingId) return;
    try {
      updateCategories(renameCustomCategory(categories, editingId, editingName), "分類已重新命名");
      setEditingId(null);
      setEditingName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法重新命名分類");
    }
  }

  function toggleCategory(id: string, disabled: boolean) {
    if (!categories) return;
    updateCategories(setCategoryDisabled(categories, id, disabled), disabled ? "分類已停用／隱藏" : "分類已啟用");
  }

  function stopRecurring(record: CashRecord) {
    if (!confirm(`確定從今天起停止「${record.title}」？歷史月份會保留。`)) return;
    const today = toDateText(new Date());
    const effectiveTo = today < record.effectiveFrom ? record.effectiveFrom : today;
    const next = records.map((item) => item.id === record.id ? { ...item, effectiveTo } : item);
    saveCashRecords(next);
    setRecords(next);
    showSuccess("固定支出已停止，歷史資料已保留");
  }

  function downloadBackup() {
    if (!categories) return;
    const backup = createCashCalendarBackup(records, budget, categories);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getBackupFilename();
    anchor.click();
    URL.revokeObjectURL(url);
    showSuccess(quarantineCount > 0 ? `備份已下載；${quarantineCount} 筆隔離資料不包含在正式備份中` : "備份已下載");
  }

  async function inspectImport(file: File) {
    setError("");
    setImportPreview(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("僅接受 JSON 備份檔。");
      return;
    }
    const raw = await file.text();
    const inspected = previewCashRecordsImport(raw);
    if (!inspected.ok) {
      setError(inspected.error);
      return;
    }
    setImportRaw(raw);
    setImportFileName(file.name);
    setImportPreview(inspected.preview);
  }

  function restoreImport() {
    if (!importPreview) return;
    if (!confirm("匯入將完整取代目前記帳、預算與分類設定。匯入前會自動備份現有資料，確定繼續？")) return;
    const result = restoreCashRecordsFromText(importRaw);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
    setImportPreview(null);
    setImportRaw("");
    setImportFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    showSuccess("備份已成功還原");
  }

  function clearAll() {
    if (!confirm("確定清除全部記帳資料？系統會先建立本機原始資料備份。")) return;
    if (!confirm("此操作會清空目前記帳畫面，但不會刪除自動備份。確定繼續？")) return;
    clearCashRecordsSafely();
    setRecords([]);
    showSuccess("全部記帳資料已清除");
  }

  const recurring = records.filter((record) => record.frequency !== "once" && record.effectiveTo === null);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-6">
        <header className="mb-6">
          <p className="text-sm text-slate-400">偏好設定與資料管理</p>
          <h1 className="mt-1 text-3xl font-black">設定</h1>
        </header>

        {message ? <p role="status" className="mb-4 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/30">{message}</p> : null}
        {error ? <p role="alert" className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 ring-1 ring-red-400/30">{error}</p> : null}

        <Section title="1. 每月預算" description="設定每月可支配的支出上限，不影響原本收入減支出的剩餘金額。">
          <p className="mb-3 text-sm text-slate-300">目前預算：{budget.monthlyBudget === null ? "尚未設定" : formatMoney(budget.monthlyBudget)}</p>
          <div className="flex gap-2">
            <input value={budgetInput} onChange={(event) => setBudgetInput(event.target.value)} inputMode="numeric" type="text" placeholder="例如 30000" className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-600 bg-slate-950 px-4 outline-none focus:border-sky-300" />
            <button type="button" onClick={saveBudget} className="rounded-2xl bg-sky-400 px-4 font-black text-slate-950">儲存</button>
          </div>
          {budget.monthlyBudget !== null ? <button type="button" onClick={clearBudget} className="mt-3 text-sm font-bold text-slate-400">取消預算設定</button> : null}
        </Section>

        <Section title="2. 分類管理" description="停用或隱藏只會影響新增選項，歷史紀錄仍保留原分類名稱。">
          <div className="flex gap-2">
            <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="新增自訂分類" className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-600 bg-slate-950 px-4 outline-none focus:border-sky-300" />
            <button type="button" onClick={addCategory} className="rounded-2xl bg-white px-4 font-black text-slate-950">新增</button>
          </div>
          <div className="mt-4 space-y-2">
            {categories?.categories.map((category) => (
              <div key={category.id} className="rounded-2xl bg-slate-800 p-3">
                {editingId === category.id ? (
                  <div className="flex gap-2">
                    <input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl bg-slate-950 px-3" />
                    <button type="button" onClick={saveRename} className="rounded-xl bg-sky-400 px-3 font-bold text-slate-950">儲存</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-xl px-2 text-slate-300">取消</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={category.disabled ? "font-bold text-slate-500 line-through" : "font-bold"}>{category.name}</p>
                      <p className="text-xs text-slate-400">{category.isSystem ? "系統預設分類" : "自訂分類"}・{category.disabled ? "已停用／隱藏" : "使用中"}</p>
                    </div>
                    <div className="flex gap-2">
                      {!category.isSystem ? <button type="button" onClick={() => { setEditingId(category.id); setEditingName(category.name); }} className="text-xs font-bold text-sky-300">改名</button> : null}
                      <button type="button" onClick={() => toggleCategory(category.id, !category.disabled)} className="text-xs font-bold text-amber-300">{category.disabled ? "啟用" : category.isSystem ? "隱藏" : "停用"}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="3. 固定支出管理" description="停止規則會設定結束日期，不會刪除歷史月份。">
          {recurring.length === 0 ? <p className="text-sm text-slate-400">目前沒有生效中的固定規則。</p> : recurring.map((record) => (
            <div key={record.id} className="mb-2 flex items-center justify-between rounded-2xl bg-slate-800 p-3">
              <div><p className="font-bold">{record.title}</p><p className="text-xs text-slate-400">{record.category}・{formatMoney(record.amount)}</p></div>
              <button type="button" onClick={() => stopRecurring(record)} className="text-sm font-bold text-red-300">停止</button>
            </div>
          ))}
        </Section>

        <Section title="4. 資料備份與還原" description="新版備份包含記帳、每月預算與分類設定；舊 v2／v3 備份仍可匯入。">
          <button type="button" onClick={downloadBackup} className="w-full rounded-2xl bg-white px-4 py-3 font-black text-slate-950">下載備份檔</button>
          <label className="mt-3 block rounded-2xl border border-dashed border-slate-600 px-4 py-3 text-center text-sm font-bold text-sky-300">
            選擇 JSON 備份
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectImport(file); }} />
          </label>
          {importPreview ? (
            <div className="mt-4 rounded-2xl bg-slate-800 p-4 text-sm">
              <p className="font-bold">{importFileName}</p>
              <p className="mt-2 text-slate-300">有效紀錄 {importPreview.records.length} 筆・無效 {importPreview.quarantined.length} 筆</p>
              <p className="text-slate-300">預算：{importPreview.includesBudget ? "包含" : "舊備份，將使用未設定預算"}</p>
              <p className="text-slate-300">自訂分類：{importPreview.includesCustomCategories ? "包含" : "未包含"}</p>
              <p className="mt-2 font-bold text-amber-200">還原方式：完整取代目前資料</p>
              <button type="button" onClick={restoreImport} className="mt-3 w-full rounded-xl bg-sky-400 px-4 py-3 font-black text-slate-950">確認還原</button>
            </div>
          ) : null}
        </Section>

        <Section title="5. 資料狀態" description="所有資料只儲存在目前瀏覽器。">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-slate-800 p-3"><p className="text-2xl font-black">{records.length}</p><p className="text-xs text-slate-400">原始記帳規則</p></div>
            <div className="rounded-2xl bg-slate-800 p-3"><p className="text-2xl font-black">{quarantineCount}</p><p className="text-xs text-slate-400">隔離資料</p></div>
          </div>
        </Section>

        <Section title="6. 清除全部資料" description="只清除記帳資料；預算與分類設定會保留。">
          <button type="button" onClick={clearAll} className="w-full rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-400/30">清除全部記帳資料</button>
        </Section>

        <Section title="7. App 資訊" description="記帳月曆 v4">
          <ul className="space-y-2 text-sm text-slate-300">
            <li>資料儲存方式：本機瀏覽器</li>
            <li>尚未支援跨裝置同步</li>
            <li>建議定期下載 JSON 備份，並保存於其他安全位置</li>
          </ul>
        </Section>

        <BottomNav />
      </div>
    </main>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-slate-400">{description}</p>
      {children}
    </section>
  );
}
