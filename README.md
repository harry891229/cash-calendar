# 記帳月曆

以月份為核心的個人記帳網頁，計算收入扣除固定支出與單次支出後的剩餘可用金額。資料只保存在目前瀏覽器的 `localStorage`，不需要帳號或後端。

## 功能

- 首頁顯示本月收入、固定支出、單次支出與剩餘金額
- 快速新增收入或支出
- 月曆檢視每日現金流
- 每月、每週及每年固定規則
- 固定規則生效與停止日期
- 舊版資料安全遷移、原始備份與無效資料隔離
- 可安裝 PWA 與四個主要頁面的離線支援
- JSON 備份下載、匯入預覽與安全還原

## 安裝 App

- Android／Chrome：開啟瀏覽器選單，選擇「安裝應用程式」。
- Windows／Edge 或 Chrome：點選網址列的安裝圖示。
- iPhone／iPad Safari：點選分享，再選「加入主畫面」。

Service Worker 只會在 production 註冊；開發模式會解除本機既有註冊，避免快取干擾。

## 開發

```bash
npm install
npm run dev
```

開啟 <http://localhost:3000>。

### 開發環境提醒

- 建議固定使用 <http://localhost:3000>；若開發伺服器自動切換到 3001，瀏覽器會把 localStorage 視為不同來源，因此看起來會像是資料消失。
- 若 3000 被占用，請先確認占用的 PID 與程序名稱，只終止屬於本專案的舊 Node／Next.js 程序，不要一次關閉所有 Node 程序。
- 開發模式不使用 production Service Worker 快取；程式會解除舊註冊並清除本專案的 Service Worker 快取。

## 品質檢查

```bash
npm run lint
npm run build
npm test
```

## 資料格式

主要 key 維持為 `cashRecords`。目前格式版本為 2：

```json
{
  "version": 2,
  "records": []
}
```

第一次讀取舊陣列格式時，程式會先建立 `cashRecordsBackupV1:*` 原始備份，再遷移合法資料。不合法資料會保存在 `cashRecordsQuarantine`，不會直接刪除。

設定頁下載的備份另包含：

```json
{
  "app": "cash-calendar",
  "version": 2,
  "exportedAt": "2026-08-03T01:02:03.000Z",
  "records": []
}
```

匯入只接受 JSON，選檔後先預覽摘要；再次確認才會備份現有 `cashRecords` 並完整取代。
