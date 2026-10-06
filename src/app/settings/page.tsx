"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import PwaInstallGuide from "@/components/PwaInstallGuide";
import { APP_INFO } from "@/lib/app-info";
import {
  addCustomCategory,
  renameCustomCategory,
  setCategoryDisabled,
} from "@/lib/categories";
import { createCashCalendarBackup, getBackupFilename } from "@/lib/backup";
import { formatMoney, parsePositiveNtd } from "@/lib/money";
import {
  findRecurringDuplicateCandidates,
  permanentlyDeleteRecurringVersion,
  stopRecurringRule,
} from "@/lib/recurring-rules";
import {
  getSettingsSectionTitle,
  SETTINGS_DIRECTORY,
  type SettingsSectionId,
} from "@/lib/settings-sections";
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
  resolveRecurringDuplicate,
  restoreResolvedRecurringDuplicate,
  saveCashRecords,
  type CashRecordsImportPreview,
} from "@/lib/storage";
import type { CashRecord, QuarantinedRecord } from "@/types/cash-record";
import type { BudgetSettings, CategorySettings } from "@/types/settings";

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimerRef = useRef<number | null>(null);
  const [records, setRecords] = useState<CashRecord[]>([]);
  const [budget, setBudget] = useState<BudgetSettings>({ version: 1, monthlyBudget: null });
  const [budgetInput, setBudgetInput] = useState("");
  const [categories, setCategories] = useState<CategorySettings | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [quarantinedRecords, setQuarantinedRecords] = useState<QuarantinedRecord[]>([]);
  const quarantineCount = quarantinedRecords.length;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importRaw, setImportRaw] = useState("");
  const [importPreview, setImportPreview] = useState<CashRecordsImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<CashRecord | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId | null>(null);

  function refresh() {
    const loadedRecords = loadCashRecords().records;
    const loadedBudget = loadBudgetSettings().value;
    const loadedCategories = loadCategorySettings().value;
    setRecords(loadedRecords);
    setBudget(loadedBudget);
    setBudgetInput(loadedBudget.monthlyBudget === null ? "" : String(loadedBudget.monthlyBudget));
    setCategories(loadedCategories);
    setQuarantinedRecords(getQuarantinedRecords());
  }

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => {
      window.clearTimeout(timer);
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  function showSuccess(value: string) {
    setError("");
    setMessage(value);
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = window.setTimeout(() => {
      setMessage("");
      successTimerRef.current = null;
    }, 3000);
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
    const next = stopRecurringRule(records, record.id, new Date());
    saveCashRecords(next);
    setRecords(next);
    showSuccess("固定支出已停止，歷史資料已保留");
  }

  function openPermanentDelete(record: CashRecord) {
    setDeleteCandidate(record);
  }

  function closePermanentDelete() {
    setDeleteCandidate(null);
  }

  function permanentlyDeleteSelectedVersion() {
    if (!deleteCandidate) return;
    const next = permanentlyDeleteRecurringVersion(
      records,
      deleteCandidate.id,
      true
    );
    saveCashRecords(next);
    setRecords(next);
    closePermanentDelete();
    showSuccess("固定規則版本已永久刪除");
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

  function openSettingsSection(section: SettingsSectionId | null) {
    setActiveSection(section);
    setMessage("");
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setError("");
    setEditingId(null);
    setDeleteCandidate(null);
    window.scrollTo({ top: 0 });
  }

  function resolveDuplicate(duplicate: CashRecord, keep: CashRecord) {
    const describe = (record: CashRecord) =>
      record.title + "・" + formatMoney(record.amount) + "・" + record.category +
      "・" + record.effectiveFrom + " 至 " + (record.effectiveTo ?? "持續生效") +
      "・ID " + record.id;
    if (!confirm(
      "保留：" + describe(keep) + "\n隔離：" + describe(duplicate) +
      "\n\n隔離會移除選取版本的所有過去與未來顯示。系統會先備份整份原始記帳資料，並保留被隔離的原始紀錄。確定繼續？"
    )) return;
    try {
      const result = resolveRecurringDuplicate(duplicate.id, keep.id, true);
      setRecords(result.records);
      setQuarantinedRecords(getQuarantinedRecords());
      showSuccess("疑似重複版本已隔離，原始資料與備份已保留");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法處理疑似重複規則");
      refresh();
    }
  }

  function restoreIsolatedDuplicate(isolated: QuarantinedRecord) {
    if (!confirm(
      "確定復原「" + getIsolatedRecordTitle(isolated) +
      "」？這會將該固定規則加回目前資料，可能再次顯示重複收支；之後新增的記帳會保留。"
    )) return;
    try {
      const result = restoreResolvedRecurringDuplicate(isolated, true);
      setRecords(result.records);
      setQuarantinedRecords(getQuarantinedRecords());
      showSuccess("固定規則已復原");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法復原隔離規則");
      refresh();
    }
  }
  function downloadQuarantinedData() {
    const quarantined = getQuarantinedRecords();
    const blob = new Blob([JSON.stringify(quarantined, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getBackupFilename().replace(".json", "-quarantine.json");
    anchor.click();
    URL.revokeObjectURL(url);
    showSuccess("隔離原始資料已下載");
  }
  const recurring = records.filter((record) => record.frequency !== "once");
  const activeRecurringCount = recurring.filter(
    (record) => record.effectiveTo === null
  ).length;
  const stoppedRecurringCount = recurring.length - activeRecurringCount;

  const duplicateCandidates = findRecurringDuplicateCandidates(records);
  const isolatedDuplicates = quarantinedRecords.filter((entry) =>
    entry.reason.startsWith("疑似重複固定規則（使用者確認隔離；")
  );
  const directorySummaries: Record<SettingsSectionId, string> = {
    budget: budget.monthlyBudget === null ? "尚未設定" : formatMoney(budget.monthlyBudget),
    categories: String(categories?.categories.length ?? 0) + " 個分類",
    recurring: "有效 " + activeRecurringCount + " 個・已停止 " + stoppedRecurringCount + " 個",
    backup: "JSON 匯出與匯入",
    data: records.length + " 筆規則・隔離 " + quarantineCount + " 筆",
    about: APP_INFO.version,
  };
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-6">
        <header className="mb-6">
          {activeSection === null ? (
            <p className="text-sm text-slate-400">偏好設定與資料管理</p>
          ) : (
            <button type="button" onClick={() => openSettingsSection(null)} className="mb-3 flex min-h-10 items-center gap-2 text-sm font-bold text-sky-300">
              <span aria-hidden="true">‹</span> 返回設定
            </button>
          )}
          <h1 className="mt-1 text-3xl font-black">{getSettingsSectionTitle(activeSection)}</h1>
        </header>

        {message ? <p role="status" aria-atomic="true" className="fixed left-1/2 top-5 z-[100] w-[calc(100%-40px)] max-w-md -translate-x-1/2 rounded-2xl bg-emerald-950/95 px-4 py-3 text-sm font-bold text-emerald-200 shadow-xl ring-1 ring-emerald-400/30">{message}</p> : null}
        {error ? <p role="alert" className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 ring-1 ring-red-400/30">{error}</p> : null}

        {activeSection === null ? (
          <div className="space-y-6">
            {SETTINGS_DIRECTORY.map((group) => (
              <section key={group.id} aria-labelledby={"settings-group-" + group.id}>
                <h2 id={"settings-group-" + group.id} className="mb-2 px-1 text-sm font-bold text-slate-400">{group.title}</h2>
                <div className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                  {group.entries.map((entry) => (
                    <button key={entry.id} type="button" onClick={() => openSettingsSection(entry.id)} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="font-bold">{entry.title}</span>
                      <span className="flex min-w-0 items-center gap-3 text-sm text-slate-400">
                        <span className="truncate">{directorySummaries[entry.id]}</span>
                        <span aria-hidden="true" className="text-xl text-slate-500">›</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {activeSection === "budget" ? (
          <Section description="設定每月可支配的支出上限，不影響收入減支出的剩餘金額。">
            <p className="mb-3 text-sm text-slate-300">目前預算：{budget.monthlyBudget === null ? "尚未設定" : formatMoney(budget.monthlyBudget)}</p>
          <div className="flex gap-2">
            <input value={budgetInput} onChange={(event) => setBudgetInput(event.target.value)} inputMode="numeric" type="text" placeholder="例如 30000" className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-600 bg-slate-950 px-4 outline-none focus:border-sky-300" />
            <button type="button" onClick={saveBudget} className="rounded-2xl bg-sky-400 px-4 font-black text-slate-950">儲存</button>
          </div>
          {budget.monthlyBudget !== null ? <button type="button" onClick={clearBudget} className="mt-3 text-sm font-bold text-slate-400">取消預算設定</button> : null}
          </Section>
        ) : null}

        {activeSection === "categories" ? (
          <Section description="停用或隱藏只會影響新增選項，歷史紀錄仍保留原分類名稱。">
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
        ) : null}

        {activeSection === "recurring" ? (
          <Section description="停止會保留歷史；永久刪除會移除選取版本的所有過去與未來顯示。">
            <p className="mb-4 text-sm font-bold text-sky-300">有效 {activeRecurringCount} 個・已停止 {stoppedRecurringCount} 個</p>
            {recurring.length === 0 ? <p className="text-sm text-slate-400">目前沒有生效中的固定規則。</p> : recurring.map((record) => (
            <div key={record.id} className="mb-2 rounded-2xl bg-slate-800 p-3">
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-bold">{record.title}</p><p className="text-xs text-slate-400">{record.category}・{formatMoney(record.amount)}・{record.effectiveTo === null ? "生效中" : `已於 ${record.effectiveTo} 停止`}</p></div>
                <div className="flex shrink-0 gap-3">
                  {record.effectiveTo === null ? <Link href={`/add?editId=${record.id}`} className="text-sm font-bold text-sky-300">編輯</Link> : null}
                  {record.effectiveTo === null ? <button type="button" onClick={() => stopRecurring(record)} className="text-sm font-bold text-amber-300">停止</button> : null}
                  <button type="button" onClick={() => openPermanentDelete(record)} className="text-sm font-bold text-red-300">永久刪除</button>
                </div>
              </div>
            </div>
          ))}
          </Section>
        ) : null}

        {activeSection === "backup" ? (
          <Section description="備份包含記帳、每月預算與分類設定；舊 v2／v3 備份仍可匯入。">
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
        ) : null}

        {activeSection === "data" ? (
          <Section description="所有資料只儲存在目前瀏覽器。">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-white/5 p-3"><p className="text-2xl font-black">{records.length}</p><p className="text-xs text-slate-400">原始記帳規則</p></div>
              <div className="rounded-2xl bg-white/5 p-3"><p className="text-2xl font-black">{quarantineCount}</p><p className="text-xs text-slate-400">隔離資料</p></div>
            </div>

            {duplicateCandidates.length > 0 ? (
              <div className="mt-6 border-t border-white/10 pt-5">
                <h2 className="font-black text-amber-200">檢查疑似重複固定收支</h2>
                <p className="mt-2 text-sm text-slate-400">以下規則的內容、排程與生效期間有重疊。請先核對是否原本就是兩筆收支，再選擇要保留的版本。</p>
                <div className="mt-4 space-y-4">
                  {duplicateCandidates.map((candidate) => (
                    <div key={candidate.original.id + ":" + candidate.duplicate.id} className="rounded-2xl bg-amber-400/5 p-3 ring-1 ring-amber-300/20">
                      <p className="mb-3 text-xs font-bold text-amber-200">重疊期間：{candidate.overlapFrom} 至 {candidate.overlapTo ?? "持續生效"}</p>
                      {[candidate.original, candidate.duplicate].map((record, index) => {
                        const other = index === 0 ? candidate.duplicate : candidate.original;
                        return (
                          <div key={record.id} className="mb-3 rounded-xl bg-slate-800 p-3 last:mb-0">
                            <p className="font-bold">紀錄 {index === 0 ? "A" : "B"}：{record.title}</p>
                            <p className="mt-1 text-sm text-slate-300">{record.recordType === "income" ? "收入" : "支出"}・{formatMoney(record.amount)}・{record.category}</p>
                            <p className="mt-1 text-xs text-slate-400">{describeRecurringSchedule(record)}</p>
                            <p className="mt-1 text-xs text-slate-400">生效：{record.effectiveFrom} 至 {record.effectiveTo ?? "持續生效"}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">ID：{record.id}</p>
                            <button type="button" onClick={() => resolveDuplicate(other, record)} className="mt-3 min-h-10 w-full rounded-xl bg-slate-700 px-3 py-2 text-sm font-bold text-sky-200">保留這筆，隔離另一筆</button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 border-t border-white/10 pt-5">
              <h2 className="font-black">隔離資料</h2>
              <p className="mt-2 text-sm text-slate-400">隔離原始資料保留於本機，不包含在一般備份檔中。清除記帳資料不會刪除隔離資料。</p>
              {isolatedDuplicates.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {isolatedDuplicates.map((isolated, index) => {
                    const details = getIsolatedRecordDetails(isolated);
                    return (
                      <div key={isolated.quarantinedAt + ":" + index} className="rounded-2xl bg-slate-800 p-3">
                        <p className="font-bold">{getIsolatedRecordTitle(isolated)}</p>
                        {details ? (
                          <>
                            <p className="mt-1 text-sm text-slate-300">{formatMoney(details.amount)}・{details.category}</p>
                            <p className="mt-1 text-xs text-slate-400">生效：{details.effectiveFrom} 至 {details.effectiveTo ?? "持續生效"}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">ID：{details.id}</p>
                          </>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-400">已確認隔離的疑似重複固定規則</p>
                        <button type="button" onClick={() => restoreIsolatedDuplicate(isolated)} className="mt-3 min-h-10 w-full rounded-xl bg-slate-700 px-3 py-2 text-sm font-bold text-sky-200">復原這筆固定規則</button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {quarantineCount > 0 ? (
                <>
                  <button type="button" onClick={downloadQuarantinedData} className="mt-3 min-h-12 w-full rounded-2xl bg-slate-800 px-4 py-3 text-sm font-bold text-sky-300">下載隔離原始資料</button>
                  <p className="mt-2 text-xs text-slate-500">此檔供保存與核對原始資料，不能當作一般記帳備份還原。</p>
                </>
              ) : null}
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <h2 className="font-black text-red-300">清除記帳資料</h2>
              <p className="mt-2 text-sm text-slate-400">只清除記帳資料；預算與分類設定會保留。系統會先建立本機原始資料備份。</p>
              <button type="button" onClick={clearAll} className="mt-3 min-h-12 w-full rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-400/30">清除全部記帳資料</button>
            </div>
          </Section>
        ) : null}

        {activeSection === "about" ? (
          <Section description={APP_INFO.name + " " + APP_INFO.version + "・" + APP_INFO.releaseStage}>
            <ul className="space-y-2 text-sm text-slate-300">
            <li>資料儲存方式：本機瀏覽器</li>
            <li>尚未支援跨裝置同步</li>
            <li>建議定期下載 JSON 備份，並保存於其他安全位置</li>
          </ul>
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="mb-3 font-black">安裝為小 App</h3>
            <PwaInstallGuide />
          </div>
          <div className="mt-5 rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-100 ring-1 ring-amber-300/20">
            <p className="font-black">正式環境資料提醒</p>
            <p className="mt-2">資料保存在這台裝置的這個瀏覽器。換手機或清除網站資料不會自動同步。</p>
            <p className="mt-2">localhost 與正式 HTTPS 網址是不同的儲存空間，資料不會自動帶過去。</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>先在 localhost 的設定頁下載 JSON 備份。</li>
              <li>開啟正式網址，在設定頁匯入該備份。</li>
              <li>確認記帳、預算與分類後，再開始使用正式網址。</li>
            </ol>
          </div>
          </Section>
        ) : null}

        {deleteCandidate ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/85 px-5" role="dialog" aria-modal="true" aria-labelledby="delete-rule-title">
            <div className="w-full max-w-md rounded-3xl bg-slate-900 p-5 shadow-2xl ring-1 ring-red-400/40">
              <p className="text-sm font-black text-red-300">高風險操作</p>
              <h2 id="delete-rule-title" className="mt-2 text-2xl font-black">永久刪除固定規則版本</h2>
              <div className="mt-4 rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-400/20">
                <p className="font-black">{deleteCandidate.title}</p>
                <p className="mt-1 text-lg font-black text-red-200">{formatMoney(deleteCandidate.amount)}</p>
              </div>
              <p className="mt-4 text-sm text-slate-300">此操作會永久刪除這個規則版本，過去與未來的顯示都會消失。</p>
              <p className="mt-2 text-sm font-black text-red-200">無法從畫面復原。</p>
              <p className="mt-3 text-sm font-bold text-amber-200">只刪除目前選取的版本；其他歷史與新版規則會保留。</p>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={closePermanentDelete} className="min-h-12 flex-1 rounded-2xl bg-slate-800 px-4 py-3 font-black">取消</button>
                <button type="button" onClick={permanentlyDeleteSelectedVersion} className="min-h-12 flex-1 rounded-2xl bg-red-600 px-4 py-3 font-black text-white shadow-lg shadow-red-950/40 ring-1 ring-red-300/30">永久刪除</button>
              </div>
            </div>
          </div>
        ) : null}

        <BottomNav />
      </div>
    </main>
  );
}

function Section({ description, children }: { description: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-4 text-sm text-slate-400">{description}</p>
      {children}
    </section>
  );
}

function describeRecurringSchedule(record: CashRecord) {
  if (record.frequency === "monthly") return "每月 " + record.dayOfMonth + " 日";
  if (record.frequency === "weekly") return "每週：" + record.dayOfWeek;
  if (record.frequency === "yearly") return "每年 " + record.monthOfYear + " 月 " + record.dayOfMonth + " 日";
  return record.date;
}

function getIsolatedRecordTitle(isolated: QuarantinedRecord) {
  const value = isolated.value;
  if (typeof value === "object" && value !== null && "title" in value &&
      typeof value.title === "string") {
    return value.title;
  }
  return "固定規則";
}

function getIsolatedRecordDetails(isolated: QuarantinedRecord) {
  if (typeof isolated.value !== "object" || isolated.value === null) return null;
  const value = isolated.value as Record<string, unknown>;
  if (typeof value.amount !== "number" || !Number.isSafeInteger(value.amount) ||
      value.amount <= 0 || typeof value.category !== "string" ||
      typeof value.effectiveFrom !== "string" || typeof value.id !== "string" ||
      (value.effectiveTo !== null && typeof value.effectiveTo !== "string")) {
    return null;
  }
  return {
    amount: value.amount,
    category: value.category,
    effectiveFrom: value.effectiveFrom,
    effectiveTo: value.effectiveTo,
    id: value.id,
  };
}
