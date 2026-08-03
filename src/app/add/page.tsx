"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { saveFlashMessage } from "@/lib/flash-message";
import { isDateText, previousDateText, toDateText } from "@/lib/date";
import { parsePositiveNtd } from "@/lib/money";
import { loadCashRecords, saveCashRecords } from "@/lib/storage";
import {
  isFrequency,
  isRecordType,
  type CashRecord,
  type Frequency,
  type RecordType,
} from "@/types/cash-record";

const categoryOptions = [
  "飲食",
  "交通",
  "房租",
  "電信",
  "訂閱",
  "薪水",
  "保險",
  "學貸",
  "其他",
];

const weekdayOptions = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];

function getTodayText() {
  return toDateText(new Date());
}

function getDefaultMonth() {
  return String(new Date().getMonth() + 1);
}

function AddPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const editId = searchParams.get("editId");
  const queryDate = searchParams.get("date");
  const queryFrequency = searchParams.get("frequency");
  const queryRecordType = searchParams.get("recordType");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [recordType, setRecordType] = useState<RecordType>("expense");
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [date, setDate] = useState(getTodayText());
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [dayOfWeek, setDayOfWeek] = useState("星期一");
  const [monthOfYear, setMonthOfYear] = useState(getDefaultMonth());
  const [category, setCategory] = useState("飲食");
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalRecord, setOriginalRecord] = useState<CashRecord | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(getTodayText());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedRecords = loadCashRecords().records;

      if (editId) {
        const targetRecord = savedRecords.find((record) => record.id === editId);

        if (!targetRecord) {
          alert("找不到這筆資料，可能已經被刪除了");
          router.push("/");
          return;
        }

        setIsEditMode(true);
        setOriginalRecord(targetRecord);
        setTitle(targetRecord.title);
        setAmount(String(targetRecord.amount));
        setRecordType(targetRecord.recordType);
        setFrequency(targetRecord.frequency);
        setDate(targetRecord.date || getTodayText());
        setDayOfMonth(targetRecord.dayOfMonth || "1");
        setDayOfWeek(targetRecord.dayOfWeek || "星期一");
        setMonthOfYear(targetRecord.monthOfYear || getDefaultMonth());
        setCategory(targetRecord.category || "其他");
        setEffectiveFrom(
          targetRecord.frequency === "once"
            ? targetRecord.date
            : getTodayText()
        );
        return;
      }

      setIsEditMode(false);

      if (queryDate && isDateText(queryDate)) {
        setDate(queryDate);
        setFrequency("once");
      }

      if (isFrequency(queryFrequency)) {
        setFrequency(queryFrequency);
      }

      if (isRecordType(queryRecordType)) {
        setRecordType(queryRecordType);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [editId, queryDate, queryFrequency, queryRecordType, router]);

  function openDatePicker() {
    const input = dateInputRef.current as
      | (HTMLInputElement & { showPicker?: () => void })
      | null;

    if (!input) return;

    if (input.showPicker) {
      input.showPicker();
      return;
    }

    input.focus();
  }

  function getRecordsFromStorage() {
    return loadCashRecords().records;
  }

  function validateForm() {
    const numberAmount = parsePositiveNtd(amount);

    if (!amount.trim()) {
      alert("請輸入金額");
      return false;
    }

    if (numberAmount === null) {
      alert("金額必須是大於 0 的新臺幣整數，且不可超過安全整數上限");
      return false;
    }

    if (frequency === "once" && !date) {
      alert("請選擇發生日期");
      return false;
    }

    if (frequency === "monthly") {
      const day = Number(dayOfMonth);

      if (!Number.isInteger(day) || day < 1 || day > 31) {
        alert("每月幾號請輸入 1 到 31");
        return false;
      }
    }

    if (frequency === "yearly") {
      const month = Number(monthOfYear);
      const day = Number(dayOfMonth);

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        alert("每年幾月請輸入 1 到 12");
        return false;
      }

      if (!Number.isInteger(day) || day < 1 || day > 31) {
        alert("每年幾號請輸入 1 到 31");
        return false;
      }
    }

    if (frequency !== "once" && !isDateText(effectiveFrom)) {
      alert("請選擇固定規則的生效日期");
      return false;
    }

    if (
      isEditMode &&
      originalRecord &&
      originalRecord.frequency !== "once" &&
      effectiveFrom <= originalRecord.effectiveFrom
    ) {
      alert(`新規則生效日期必須晚於 ${originalRecord.effectiveFrom}`);
      return false;
    }

    return true;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isValid = validateForm();

    if (!isValid) return;

    const savedRecords = getRecordsFromStorage();
    const finalTitle = title.trim() || category;
    const numberAmount = parsePositiveNtd(amount);
    if (numberAmount === null) return;

    if (isEditMode && editId) {
      const target = savedRecords.find((record) => record.id === editId);
      if (!target) {
        alert("找不到這筆資料，可能已經被刪除了");
        return;
      }

      let nextRecords: CashRecord[];

      if (target.frequency === "once") {
        nextRecords = savedRecords.map((record) =>
          record.id === editId
            ? {
                ...record,
                title: finalTitle,
                amount: numberAmount,
                recordType,
                frequency,
                date,
                dayOfMonth,
                dayOfWeek,
                monthOfYear,
                category,
                effectiveFrom: date,
              }
            : record
        );
      } else {
        const oldEffectiveTo = previousDateText(effectiveFrom);
        if (!oldEffectiveTo) return;

        const closedRecords = savedRecords.map((record) =>
          record.id === editId
            ? { ...record, effectiveTo: oldEffectiveTo }
            : record
        );
        const replacement: CashRecord = {
          ...target,
          id: crypto.randomUUID(),
          title: finalTitle,
          amount: numberAmount,
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
        nextRecords = [replacement, ...closedRecords];
      }

      saveCashRecords(nextRecords);
      saveFlashMessage("修改成功");
      router.push("/");
      return;
    }

    const newRecord: CashRecord = {
      id: crypto.randomUUID(),
      title: finalTitle,
      amount: numberAmount,
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

    const nextRecords = [newRecord, ...savedRecords];

    saveCashRecords(nextRecords);
    saveFlashMessage("新增成功");
    router.push("/");
  }

  const inputClass =
    "h-12 w-full rounded-2xl border border-slate-500 bg-slate-950 px-4 text-white outline-none placeholder:text-slate-500 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30";

  const selectClass =
    "h-12 w-full appearance-none rounded-2xl border border-slate-500 bg-slate-950 px-4 text-white outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30";

  const optionClass = "bg-slate-900 text-white";

  function getChoiceButtonClass(isActive: boolean) {
    if (isActive) {
      return "rounded-2xl bg-white px-4 py-3 font-black text-slate-950 shadow-lg";
    }

    return "rounded-2xl px-4 py-3 font-bold text-white";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <style jsx global>{`
        input[type="date"] {
          color-scheme: dark;
        }

        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0;
          display: none;
        }
      `}</style>

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-5">
        <header className="mb-6">
          <p className="text-sm text-slate-300">
            {isEditMode ? "修改原本那筆資料" : "建立新的收入或支出"}
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight">
            {isEditMode ? "編輯這筆收支" : "新增一筆收支"}
          </h1>
        </header>

        {isEditMode ? (
          <section className="mb-5 rounded-3xl bg-sky-950 p-4 ring-1 ring-sky-400/40">
            <p className="font-bold text-sky-200">目前是編輯模式</p>
            <p className="mt-1 text-sm text-slate-300">
              儲存後會更新原本那筆資料，不會新增一筆。
            </p>
          </section>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-1">
          <section className="rounded-3xl bg-slate-900 p-5 shadow-xl ring-1 ring-slate-800">
            <h2 className="mb-3 text-lg font-bold">基本資料</h2>

            <label className="block">
              <p className="mb-1 text-sm text-slate-300">名稱</p>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
                placeholder="例如：午餐、房租、薪水"
              />
              <p className="mt-2 text-xs text-slate-400">
                可以不填，不填會自動用分類名稱。
              </p>
            </label>

            <label className="mt-3 block">
              <p className="mb-1 text-sm text-slate-300">金額</p>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={inputClass}
                type="number"
                min="1"
                step="1"
                max={Number.MAX_SAFE_INTEGER}
                inputMode="numeric"
                placeholder="例如：1000"
              />
            </label>
          </section>

          <section className="rounded-3xl bg-slate-900 p-5 shadow-xl ring-1 ring-slate-800">
            <h2 className="mb-3 text-lg font-bold">類型</h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRecordType("expense")}
                className={getChoiceButtonClass(recordType === "expense")}
              >
                支出
              </button>

              <button
                type="button"
                onClick={() => setRecordType("income")}
                className={getChoiceButtonClass(recordType === "income")}
              >
                收入
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-slate-900 p-5 shadow-xl ring-1 ring-slate-800">
            <h2 className="mb-3 text-lg font-bold">週期</h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFrequency("once")}
                className={getChoiceButtonClass(frequency === "once")}
              >
                單次
              </button>

              <button
                type="button"
                onClick={() => setFrequency("monthly")}
                className={getChoiceButtonClass(frequency === "monthly")}
              >
                每月
              </button>

              <button
                type="button"
                onClick={() => setFrequency("weekly")}
                className={getChoiceButtonClass(frequency === "weekly")}
              >
                每週
              </button>

              <button
                type="button"
                onClick={() => setFrequency("yearly")}
                className={getChoiceButtonClass(frequency === "yearly")}
              >
                每年
              </button>
            </div>
          </section>

          <section className="min-h-[132px] rounded-3xl bg-slate-900 p-5 shadow-xl ring-1 ring-slate-800">
            <h2 className="mb-3 text-lg font-bold">時間設定</h2>

            {frequency !== "once" ? (
              <label className="mb-3 block">
                <p className="mb-1 text-sm text-slate-300">
                  {isEditMode ? "新規則生效日期" : "生效日期"}
                </p>
                <input
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  className={inputClass}
                  type="date"
                />
                {isEditMode && originalRecord?.frequency !== "once" ? (
                  <p className="mt-2 text-xs text-slate-400">
                    舊規則會保留至新生效日期前一天，歷史月份不會被改寫。
                  </p>
                ) : null}
              </label>
            ) : null}

            {frequency === "once" ? (
              <label className="block">
                <p className="mb-1 text-sm text-slate-300">發生日期</p>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    ref={dateInputRef}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={inputClass}
                    type="date"
                  />

                  <button
                    type="button"
                    onClick={openDatePicker}
                    className="h-12 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 shadow-lg"
                  >
                    選日期
                  </button>
                </div>
              </label>
            ) : null}

            {frequency === "monthly" ? (
              <label className="block">
                <p className="mb-1 text-sm text-slate-300">每月幾號</p>
                <input
                  value={dayOfMonth}
                  onChange={(event) => setDayOfMonth(event.target.value)}
                  className={inputClass}
                  type="number"
                  min="1"
                  max="31"
                  placeholder="例如：7"
                />
              </label>
            ) : null}

            {frequency === "weekly" ? (
              <label className="block">
                <p className="mb-1 text-sm text-slate-300">每週星期幾</p>
                <select
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(event.target.value)}
                  className={selectClass}
                >
                  {weekdayOptions.map((weekday) => (
                    <option
                      key={weekday}
                      value={weekday}
                      className={optionClass}
                    >
                      {weekday}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {frequency === "yearly" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <p className="mb-1 text-sm text-slate-300">每年幾月</p>
                  <input
                    value={monthOfYear}
                    onChange={(event) => setMonthOfYear(event.target.value)}
                    className={inputClass}
                    type="number"
                    min="1"
                    max="12"
                    placeholder="例如：6"
                  />
                </label>

                <label className="block">
                  <p className="mb-1 text-sm text-slate-300">幾號</p>
                  <input
                    value={dayOfMonth}
                    onChange={(event) => setDayOfMonth(event.target.value)}
                    className={inputClass}
                    type="number"
                    min="1"
                    max="31"
                    placeholder="例如：10"
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl bg-slate-900 p-5 shadow-xl ring-1 ring-slate-800">
            <h2 className="mb-3 text-lg font-bold">分類</h2>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={selectClass}
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item} className={optionClass}>
                  {item}
                </option>
              ))}
            </select>
          </section>

          <div className="sticky bottom-20 z-20 pt-3">
            <button
              type="submit"
              className="w-full rounded-3xl px-4 py-4 text-lg font-black shadow-2xl"
              style={{
                backgroundColor: "#38bdf8",
                color: "#020617",
                boxShadow: "0 18px 45px rgba(56, 189, 248, 0.25)",
              }}
            >
              {isEditMode ? "更新資料" : "儲存"}
            </button>
          </div>
        </form>

        <BottomNav />
      </div>
    </main>
  );
}

export default function AddPage() {
  return (
    <Suspense fallback={null}>
      <AddPageContent />
    </Suspense>
  );
}
