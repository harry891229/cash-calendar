"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-slate-950 text-white">
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-bold text-amber-300">發生非預期錯誤</p>
          <h1 className="mt-2 text-3xl font-black">記帳資料仍保留在瀏覽器中</h1>
          <p className="mt-4 text-slate-300">請重新嘗試；此頁面不會清除或改寫本機資料。</p>
          <div className="mt-6 flex w-full gap-3">
            <button type="button" onClick={reset} className="flex-1 rounded-2xl bg-sky-400 px-4 py-3 font-black text-slate-950">重新嘗試</button>
            <Link href="/" className="flex-1 rounded-2xl bg-slate-800 px-4 py-3 font-black">返回首頁</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
