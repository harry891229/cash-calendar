"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "首頁",
    href: "/",
  },
  {
    label: "月曆",
    href: "/calendar",
  },
  {
    label: "新增",
    href: "/add",
  },
  {
    label: "設定",
    href: "/settings",
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed z-50 rounded-full bg-white/10 p-2 shadow-2xl backdrop-blur-md ring-1 ring-white/10"
      style={{
        left: "50%",
        bottom: "16px",
        width: "calc(100% - 40px)",
        maxWidth: "430px",
        transform: "translateX(-50%)",
      }}
    >
      <div className="grid grid-cols-4 text-center text-xs text-slate-300">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "rounded-full bg-white py-3 font-bold text-slate-950"
                  : "py-3"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}