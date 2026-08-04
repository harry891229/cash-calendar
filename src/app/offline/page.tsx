import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div>
        <p className="text-sm font-bold text-amber-300">目前沒有網路連線</p>
        <h1 className="mt-2 text-3xl font-black">這個頁面尚未離線快取</h1>
        <p className="mt-3 text-slate-400">連線恢復後請重新載入。已儲存在瀏覽器的記帳資料不會被清除。</p>
        <Link href="/" className="mt-6 inline-block rounded-2xl bg-sky-400 px-5 py-3 font-black text-slate-950">返回已快取首頁</Link>
      </div>
    </main>
  );
}
