# 記帳月曆

記帳月曆是使用 Next.js 16 App Router、React、TypeScript 與 Tailwind CSS 建立的本機優先 PWA。記帳、預算與分類資料儲存在目前瀏覽器的 `localStorage`，不需要帳號或後端。

## 正式專案位置

建議將專案放在一般本機開發目錄，例如：

```text
D:\Projects\cash-calendar
```

不要將正式開發工作區放在 OneDrive，同步大量 `.next` 與 `node_modules` 小檔案可能造成鎖定、刪除確認與建置速度問題。

## 本機開發

```bash
npm install
npm run dev
```

固定使用 <http://localhost:3000>。若自動切換到 3001，瀏覽器會視為不同來源，因此 localStorage 資料不共用。開發模式會解除 production Service Worker 並清除本 App 的快取。

## Production build

```bash
npm run lint
npm run build
npm test
```

本專案目前不需要任何環境變數。`NEXT_DIST_DIR` 只供特殊 CI 驗證選擇輸出目錄，正常部署不需要設定。

## Vercel 部署

Vercel 是本專案建議的部署平台，因為它原生支援 Next.js App Router、HTTPS、靜態資源快取與 GitHub 自動部署。

1. 將 GitHub repository 匯入 Vercel。
2. Framework Preset 選擇 Next.js。
3. Build Command 使用預設的 `next build`。
4. Output Directory 保持預設，不要設定 static export。
5. 不需要新增環境變數。
6. 部署後確認 `/manifest.webmanifest`、`/sw.js` 與 `/icons/*` 可透過 HTTPS 讀取。

若尚未登入 Vercel，請由使用者自行完成 GitHub／Vercel 授權；專案不需要保存 token 或密碼。

## PWA 安裝

- Android Chrome：瀏覽器選單 → 安裝應用程式。
- Windows Edge／Chrome：點選網址列右側的安裝圖示。
- iPhone／iPad Safari：分享 → 加入主畫面。iOS 沒有 `beforeinstallprompt`。

Chrome／Edge 支援安裝事件時，設定頁會顯示「安裝 App」按鈕。已在 standalone 模式開啟時不會重複顯示。

## localhost 與正式網址資料移轉

localhost 與正式 HTTPS 網址是不同的瀏覽器來源，資料不會自動同步，也無法跨來源讀取 localStorage。

1. 在 localhost 開啟設定頁並下載 JSON 備份。
2. 開啟正式 HTTPS 網址。
3. 在正式網址的設定頁匯入備份。
4. 確認記帳、每月預算與分類後再開始正式使用。

換手機、換瀏覽器或清除網站資料也不會自動同步，請定期下載備份。

## 發布新版

發布前必須同步更新：

1. `src/lib/app-info.ts` 的 `APP_VERSION`。
2. `public/sw.js` 頂端唯一的 `CACHE_VERSION`。
3. 執行 lint、build 與全部測試。
4. 建立 Git commit 與版本 tag，再由 Vercel 部署。

新版 Service Worker 安裝完成後會等待，畫面顯示「有新版本可用」。只有使用者按下「立即更新」才會啟用並重新載入一次，不會在輸入記帳時強制更新。

## 回滾

- Git：切回已驗證的 release tag，再建立回滾部署。
- Vercel：在 Deployments 中選擇先前成功版本並 Promote／Redeploy。

回滾程式不會主動清除 localStorage。若新版資料格式曾新增欄位，操作前仍建議下載 JSON 備份。

## 資料格式

- 記帳 key：`cashRecords`
- 記帳 schema：version 2
- 預算與分類使用獨立、有版本的設定 key
- 新版備份包含 `appVersion`、記帳、預算與分類
- 舊 v2／v3 備份缺少 `appVersion` 或新設定欄位時仍可匯入
