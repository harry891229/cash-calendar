# 現金流月曆

以月份為核心的個人記帳網頁，計算收入扣除固定支出與單次支出後的剩餘可用金額。資料只保存在目前瀏覽器的 `localStorage`，不需要帳號或後端。

## 功能

- 首頁顯示本月收入、固定支出、單次支出與剩餘金額
- 快速新增收入或支出
- 月曆檢視每日現金流
- 每月、每週及每年固定規則
- 固定規則生效與停止日期
- 舊版資料安全遷移、原始備份與無效資料隔離

## 開發

```bash
npm install
npm run dev
```

開啟 <http://localhost:3000>。

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
