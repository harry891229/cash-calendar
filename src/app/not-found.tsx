import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div>
        <p className="text-sm font-bold text-sky-300">404</p>
        <h1 className="mt-2 text-3xl font-black">找不到這個頁面</h1>
        <p className="mt-3 text-slate-400">網址可能已變更，記帳資料不受影響。</p>
        <Link href="/" className="mt-6 inline-block rounded-2xl bg-sky-400 px-5 py-3 font-black text-slate-950">返回首頁</Link>
      </div>
    </main>
  );
}
