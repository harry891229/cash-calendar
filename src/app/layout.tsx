import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import FlashToast from "@/components/FlashToast";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/app-info";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: APP_NAME,
  description: "以月曆管理收入、固定支出與單次支出的個人記帳工具",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_SHORT_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <FlashToast />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
