# 批次收據生成器 (Batch Receipt Generator)

純前端、完全在瀏覽器端運作的批次 PDF 收據生成工具。

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)

---

## ✨ 功能特色

- **隱私安全**：所有資料處理在瀏覽器本地完成，零數據上傳
- **批次生成**：一次處理多筆 CSV 資料，自動生成多份 PDF
- **中文支援**：內建 Noto Sans TC 字體動態載入，繁體中文完美顯示
- **ZIP 下載**：所有 PDF 打包為一個 `.zip` 檔案，一鍵下載
- **零設定**：開啟 `index.html` 即可使用，無需安裝任何軟體

---

## 🚀 快速開始

### 本機使用
> 由於瀏覽器安全限制，必須透過 HTTP Server 開啟（不能直接雙擊 `index.html`）。

```bash
# 使用 Python 3
python3 -m http.server 8080

# 或使用 Node.js
npx serve .
```

然後開啟 `http://localhost:8080`

### GitHub Pages 部署

1. Fork 或上傳此專案至你的 GitHub Repository
2. 進入 **Settings → Pages → Source** 選擇 `main` branch
3. 等待約 1 分鐘，訪問 `https://<你的帳號>.github.io/<repo名稱>/`

---

## 📄 CSV 格式規範

| 欄位 | 說明 | 必填 | 範例 |
|------|------|------|------|
| `id` | 收據編號 | ✅ | 2024001 |
| `date` | 開立日期 | ✅ | 2024-03-01 |
| `customer` | 客戶名稱 | ✅ | 王大明 |
| `item` | 品項名稱 | ✅ | 網站維護費 |
| `amount` | 金額（數字） | ✅ | 5000 |
| `note` | 備註 | ❌ | 2月費用 |

> 💡 **Excel 使用者**：請在 Excel 中選擇「另存新檔 → CSV UTF-8 (逗號分隔)」以避免中文亂碼。

範例檔案：[sample.csv](./sample.csv)

---

## 🛠️ 技術架構

```
receipt-generator/
├── index.html          # 主頁面 (SPA)
├── css/
│   └── style.css       # 樣式表
├── js/
│   ├── font-loader.js  # 動態字體載入 (NotoSansTC from CDN)
│   ├── pdf-generator.js# pdfmake PDF 排版生成
│   └── app.js          # 主控制邏輯
└── sample.csv          # 範例資料
```

### 使用的函式庫（全部 CDN）

| 函式庫 | 版本 | 用途 |
|--------|------|------|
| [pdfmake](https://pdfmake.github.io/docs/) | 0.2.7 | PDF 排版生成 |
| [PapaParse](https://www.papaparse.com/) | 5.4.1 | CSV 解析 |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | ZIP 壓縮打包 |

---

## ⚙️ 字體說明

本工具在首次載入時，會從 jsDelivr CDN 動態下載 **Noto Sans CJK TC** 字體（約 4 MB）。

若字體下載失敗（如網路受限），PDF 仍可生成，但中文字元會顯示為方框（□）。

### 使用本機字體（進階）

如需離線使用或加快載入速度，可將字體預先轉換並嵌入：

1. 下載 [NotoSansTC-Regular.otf](https://fonts.google.com/noto/specimen/Noto+Sans+TC)
2. 使用 pdfmake 的字體轉換工具：
   ```bash
   # 安裝 pdfmake cli 工具
   npm install -g pdfmake
   # 轉換字體為 VFS 格式
   npx pdfmake-fontconverter ./fonts ./js/vfs_fonts_custom.js
   ```
3. 在 `index.html` 中引入 `vfs_fonts_custom.js` 並修改 `font-loader.js`

---

## 📝 注意事項

- 建議單次處理 **100 筆以內**，避免瀏覽器記憶體不足
- 支援瀏覽器：Chrome 89+、Edge 88+、Firefox 86+、Safari 14+
- 頁面重整後，所有資料將清空（無本機存儲）

---

## 📋 授權

MIT License
