"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getActiveCategories } from "@/lib/categories";
import { isDateText, previousDateText, toDateText } from "@/lib/date";
import { saveFlashMessage } from "@/lib/flash-message";
import { parsePositiveNtd } from "@/lib/money";
import { loadCategorySettings, saveCategorySettings } from "@/lib/settings-storage";
import { loadCashRecords, saveCashRecords } from "@/lib/storage";
import { createSubmissionGuard } from "@/lib/submission-guard";
import {
  isFrequency,
  isRecordType,
  WEEKDAYS,
  type CashRecord,
  type Frequency,
  type RecordType,
} from "@/types/cash-record";
import type { CategorySettings } from "@/types/settings";

function todayText() {
  return toDateText(new Date());
}

function AddPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const guardRef = useRef(createSubmissionGuard());
  const editId = searchParams.get("editId");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [recordType, setRecordType] = useState<RecordType>("expense");
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [date, setDate] = useState(todayText());
  const [effectiveFrom, setEffectiveFrom] = useState(todayText());
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [dayOfWeek, setDayOfWeek] = useState<(typeof WEEKDAYS)[number]>(WEEKDAYS[1]);
  const [monthOfYear, setMonthOfYear] = useState(String(new Date().getMonth() + 1));
  const [category, setCategory] = useState("其他");
  const [categorySettings, setCategorySettings] = useState<CategorySettings | null>(null);
  const [originalRecord, setOriginalRecord] = useState<CashRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const settings = loadCategorySettings().value;
      setCategorySettings(settings);
      const active = getActiveCategories(settings);
      const last = active.find((item) => item.id === settings.lastUsedExpenseCategoryId);
      const records = loadCashRecords().records;

      if (editId) {
        const target = records.find((record) => record.id === editId);
        if (!target) {
          setError("找不到要編輯的記帳資料。");
          return;
        }
        setOriginalRecord(target);
        setTitle(target.title);
        setAmount(String(target.amount));
        setRecordType(target.recordType);
        setFrequency(target.frequency);
        setDate(target.date);
        setEffectiveFrom(target.frequency === "once" ? target.date : todayText());
        setDayOfMonth(target.dayOfMonth);
        setDayOfWeek(target.dayOfWeek as (typeof WEEKDAYS)[number]);
        setMonthOfYear(target.monthOfYear);
        setCategory(target.category);
        return;
      }

      if (last) setCategory(last.name);
      else if (active[0]) setCategory(active[0].name);

      const queryDate = searchParams.get("date");
      const queryFrequency = searchParams.get("frequency");
      const queryRecordType = searchParams.get("recordType");
      if (queryDate && isDateText(queryDate)) setDate(queryDate);
      if (isFrequency(queryFrequency)) setFrequency(queryFrequency);
      if (isRecordType(queryRecordType)) setRecordType(queryRecordType);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editId, searchParams]);

  function validate() {
    const parsed = parsePositiveNtd(amount);
    if (parsed === null) return "金額必須是新臺幣安全正整數。";
    if (frequency === "once" && !isDateText(date)) return "請選擇有效日期。";
    if (frequency !== "once" && !isDateText(effectiveFrom)) return "請選擇有效生效日期。";
    const day = Number(dayOfMonth);
    if ((frequency === "monthly" || frequency === "yearly") && (!Number.isInteger(day) || day < 1 || day > 31)) return "日期必須介於 1 到 31。";
    const month = Number(monthOfYear);
    if (frequency === "yearly" && (!Number.isInteger(month) || month < 1 || month > 12)) return "月份必須介於 1 到 12。";
    if (originalRecord?.frequency !== "once" && originalRecord && effectiveFrom <= originalRecord.effectiveFrom) return `新規則生效日必須晚於 ${originalRecord.effectiveFrom}。`;
    return null;
  }

  function rememberCategory() {
    if (!categorySettings || recordType !== "expense") return;
    const selected = categorySettings.categories.find((item) => item.name === category);
    if (!selected) return;
    const next = { ...categorySettings, lastUsedExpenseCategoryId: selected.id };
    saveCategorySettings(next);
    setCategorySettings(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guardRef.current.tryLock()) return;
    const validationError = validate();
    if (validationError) {
      guardRef.current.unlock();
      setError(validationError);
      return;
    }
    setError("");
    setIsSaving(true);

    try {
      const records = loadCashRecords().records;
      const parsedAmount = parsePositiveNtd(amount);
      if (parsedAmount === null) throw new Error("金額格式不合法");
      const finalTitle = title.trim() || category;

      if (originalRecord && editId) {
        let nextRecords: CashRecord[];
        if (originalRecord.frequency === "once") {
          nextRecords = records.map((record) => record.id === editId ? {
            ...record,
            title: finalTitle,
            amount: parsedAmount,
            recordType,
            frequency,
            date,
            dayOfMonth,
            dayOfWeek,
            monthOfYear,
            category,
            effectiveFrom: frequency === "once" ? date : effectiveFrom,
            effectiveTo: null,
          } : record);
        } else {
          const oldEffectiveTo = previousDateText(effectiveFrom);
          if (!oldEffectiveTo) throw new Error("無法建立歷史結束日期");
          const closed = records.map((record) => record.id === editId ? { ...record, effectiveTo: oldEffectiveTo } : record);
          const replacement: CashRecord = {
            ...originalRecord,
            id: crypto.randomUUID(),
            title: finalTitle,
            amount: parsedAmount,
            recordType,
            frequency,
            date,
            dayOfMonth,
            dayOfWeek,
            monthOfYear,
            category,
            effectiveFrom,
            effectiveTo: null,
            createdAt: new Date().toISOString(),
          };
          nextRecords = [replacement, ...closed];
        }
        saveCashRecords(nextRecords);
        rememberCategory();
        saveFlashMessage("修改成功");
        router.push("/");
        return;
      }

      const newRecord: CashRecord = {
        id: crypto.randomUUID(),
        title: finalTitle,
        amount: parsedAmount,
        recordType,
        frequency,
        date,
        dayOfMonth,
        dayOfWeek,
        monthOfYear,
        category,
        createdAt: new Date().toISOString(),
        effectiveFrom: frequency === "once" ? date : effectiveFrom,
        effectiveTo: null,
      };
      saveCashRecords([newRecord, ...records]);
      rememberCategory();
      saveFlashMessage("新增成功");
      router.push("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "儲存失敗");
      setIsSaving(false);
      guardRef.current.unlock();
    }
  }

  const activeCategories = categorySettings ? getActiveCategories(categorySettings) : [];
  const visibleCategories = activeCategories.some((item) => item.name === category)
    ? activeCategories
    : category
      ? [{ id: "historical", name: category, isSystem: false, disabled: true, createdAt: "" }, ...activeCategories]
      : activeCategories;
  const inputClass = "h-12 w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 text-white outline-none focus:border-sky-300";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-6">
        <header className="mb-5">
          <p className="text-sm text-slate-400">{originalRecord ? "保留歷史的安全編輯" : "快速完成一筆常用記帳"}</p>
          <h1 className="mt-1 text-3xl font-black">{originalRecord ? "編輯記帳" : "新增一筆收支"}</h1>
        </header>

        {error ? <p role="alert" className="mb-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 ring-1 ring-red-400/30">{error}</p> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <label><span className="mb-1 block text-sm text-slate-300">金額</span><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} type="text" inputMode="numeric" placeholder="例如 120" className={`${inputClass} text-xl font-black`} /></label>
            <label className="mt-3 block"><span className="mb-1 block text-sm text-slate-300">備註（選填）</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="留空會使用分類名稱" className={inputClass} /></label>
          </section>

          <section className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <h2 className="mb-3 font-bold">快速選分類</h2>
            <div className="grid grid-cols-3 gap-2">
              {visibleCategories.map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.name)} className={category === item.name ? "rounded-2xl bg-sky-400 px-2 py-3 text-sm font-black text-slate-950" : "rounded-2xl bg-slate-800 px-2 py-3 text-sm font-bold text-slate-200"}>{item.name}</button>)}
            </div>
          </section>

          <section className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRecordType("expense")} className={recordType === "expense" ? "rounded-2xl bg-white py-3 font-black text-slate-950" : "rounded-2xl bg-slate-800 py-3 font-bold"}>支出</button>
              <button type="button" onClick={() => setRecordType("income")} className={recordType === "income" ? "rounded-2xl bg-white py-3 font-black text-slate-950" : "rounded-2xl bg-slate-800 py-3 font-bold"}>收入</button>
            </div>
            <label className="mt-3 block"><span className="mb-1 block text-sm text-slate-300">日期</span><input value={date} onChange={(event) => setDate(event.target.value)} type="date" className={inputClass} /></label>
          </section>

          <details className="rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800" open={frequency !== "once"}>
            <summary className="cursor-pointer font-bold">進階：固定規則</summary>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["once", "monthly", "weekly", "yearly"] as Frequency[]).map((item) => <button key={item} type="button" onClick={() => setFrequency(item)} className={frequency === item ? "rounded-xl bg-sky-400 py-2 font-bold text-slate-950" : "rounded-xl bg-slate-800 py-2 text-sm"}>{item === "once" ? "單次" : item === "monthly" ? "每月" : item === "weekly" ? "每週" : "每年"}</button>)}
            </div>
            {frequency !== "once" ? <label className="mt-3 block"><span className="mb-1 block text-sm text-slate-300">生效日期</span><input value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} type="date" className={inputClass} /></label> : null}
            {frequency === "monthly" || frequency === "yearly" ? <label className="mt-3 block"><span className="mb-1 block text-sm text-slate-300">每次日期（1～31）</span><input value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} inputMode="numeric" className={inputClass} /></label> : null}
            {frequency === "weekly" ? <label className="mt-3 block"><span className="mb-1 block text-sm text-slate-300">星期</span><select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value as (typeof WEEKDAYS)[number])} className={inputClass}>{WEEKDAYS.map((weekday) => <option key={weekday}>{weekday}</option>)}</select></label> : null}
            {frequency === "yearly" ? <label className="mt-3 block"><span className="mb-1 block text-sm text-slate-300">月份（1～12）</span><input value={monthOfYear} onChange={(event) => setMonthOfYear(event.target.value)} inputMode="numeric" className={inputClass} /></label> : null}
          </details>

          <button type="submit" disabled={isSaving} className="sticky bottom-20 z-20 w-full rounded-3xl bg-sky-400 px-4 py-4 text-lg font-black text-slate-950 shadow-2xl disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "儲存中…" : originalRecord ? "儲存修改" : "儲存記帳"}</button>
        </form>
        <BottomNav />
      </div>
    </main>
  );
}

export default function AddPage() {
  return <Suspense fallback={null}><AddPageContent /></Suspense>;
}
