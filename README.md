# 批次收據生成器 (Batch Receipt Generator)

純前端、完全在瀏覽器端運作的批次 PDF 收據生成工具。

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)

**Demo: https://receipt.back2.top/**

![main page](https://github.com/user-attachments/assets/2ee12226-6e6d-4fa7-ab2d-95d8e60a87ea)

| 普通版收據 | 精美版收據 |
|------|------|
| ![普通版收據](https://github.com/user-attachments/assets/4c6a0ba8-0795-4d31-b252-f648784c7527) | ![精美版收據](https://github.com/user-attachments/assets/2ca8c222-0edb-4b1d-8368-3ff1d428bab8) |

---

## 功能特色

- **隱私安全**：所有資料處理均在您的瀏覽器本地端完成，零數據上傳，保護您的敏感個資。
- **批次生成**：一次匯入多筆 CSV 資料，即可自動生成多份獨立的 PDF 收據。
- **雙版本收據**：支援生成「普通版」與設計優雅的「精美版」收據，滿足不同情境需求。
- **完美中文支援**：內建動態載入中文字體（如 cwTeXQKai / Noto Sans TC），繁體中文完美顯示不過版、不亂碼。
- **彈性檔名設定**：可自訂匯出的 PDF 檔名格式（支援動態變數：姓名、月份、年份、項目等）。
- **一鍵 ZIP 下載**：將所有生成的 PDF 自動打包為一個 `.zip` 壓縮檔，方便一次下載與管理。
- **零設定需求**：開啟網頁即可立即使用，無須安裝任何軟體。

---

## 使用方式

### Step 1: 準備資料與設定

1. 準備好您的資料 CSV 檔案。您可以點擊介面上的「下載範本 CSV」來參考標準格式。
2. 於網頁介面上輸入「機構名稱」與「收據日期」。
3. 設定預期的「檔名格式」（支援變數，如 `{name}-{year}`）。

### Step 2: 匯入 CSV 

1. 將準備好的 `.csv` 檔案拖曳至指定區域，或點選「選擇檔案」上傳。
2. 也支援直接將 CSV 內容文字貼上至下方的文字輸入框中。
3. 點擊「解析並預覽」進入下一步。

### Step 3: 確認資料與生成 PDF

1. 系統會顯示資料解析的預覽表格，請在此確認資料是否正確。
2. 確認無誤後，選擇點擊下方「普通版收據」或「精美版收據」按鈕。
3. 系統將開始批次生成 PDF，進度條跑完後，將會自動跳出下載提示，為您下載包含所有收據的 `.zip` 檔案。

   ![step2](https://github.com/user-attachments/assets/087c20df-3663-4776-9d3b-f626b0ea8837)

### Step 4: 完成收據製作

   | 普通版收據 | 精美版收據 |
   |------|------|
   | ![普通版收據](https://github.com/user-attachments/assets/4c6a0ba8-0795-4d31-b252-f648784c7527) | ![精美版收據](https://github.com/user-attachments/assets/2ca8c222-0edb-4b1d-8368-3ff1d428bab8) |

---

## 整合至其他網站（/generate API）

如果你有其他網站，想讓使用者點擊按鈕後直接跳轉並自動下載收據 ZIP，可以使用 `/generate` 路由。

### 網址格式

```
https://your-site.pages.dev/generate?org=...&date=...&template=...&csv=...
```

### 參數說明

| 參數 | 必填 | 說明 | 預設值 |
|------|------|------|------|
| `csv` | ✅ | URL-encoded 的 CSV 內容（格式與主介面相同） | — |
| `org` | ❌ | 機構名稱 | 空 |
| `date` | ❌ | 收據日期，格式 `YYYY-MM-DD` | 當天日期 |
| `pattern` | ❌ | 檔名格式，支援 `{name}`、`{month_zh}` 等變數 | `{name}-{month_zh}` |
| `template` | ❌ | 收據版型：`normal`（普通版）或 `beautiful`（精美版） | `beautiful` |

### 使用範例

在你的網站加入以下程式碼，使用者點擊按鈕後即可自動開啟生成頁面並下載：

```js
function generateReceipts() {
  const csvData = [
    'customer,item,amount,id_number,phone',
    '王小明,車馬費,1000,A123456789,0912345678',
    '李小美,誤餐費,800,,',
  ].join('\n');

  const query = new URLSearchParams({
    org: 'XX 社會福利基金會',
    date: '2026-04-01',
    template: 'beautiful',
    pattern: '{name}-{month_zh}',
    csv: csvData,
  });

  window.open(`https://your-site.pages.dev/generate?${query}`);
}
```

```html
<button onclick="generateReceipts()">下載收據 ZIP</button>
```

### 生成頁面流程

使用者開啟連結後，頁面會自動執行以下步驟，全程無需任何操作：

1. 載入中文字體（首次約需數秒，之後瀏覽器會快取）
2. 解析 CSV 資料並逐份生成 PDF
3. 打包為 ZIP 並自動觸發下載
4. 顯示完成畫面（提供「重新下載」按鈕）

> **注意**：CSV 資料是透過 URL query string 傳遞，瀏覽器對網址長度有限制（約 8,000 字元）。建議**單次傳入 50 筆以內**的資料；若資料量較大，建議在自己的網站分批呼叫。

---

## CSV 格式規範

請確保您的 CSV 檔案包含以下標題欄位（順序不限）：

| 欄位名稱 | 說明 | 必填 | 範例 |
|------|------|------|------|
| `customer` | 領款人姓名 | ✅ | 王小明 |
| `item` | 請款項目 | ✅ | 車馬費 |
| `amount` | 金額（阿拉伯數字，系統會自動轉為國字大寫） | ✅ | 1000 |
| `id_number` | 身分證字號 | ❌ | E126154740 |
| `address` | 戶籍地址 | ❌ | 高雄市三民區... |
| `phone` | 連絡電話 | ❌ | 0955980488 |
| `note` | 備註 | ❌ | 出差補助 |
| `org` | 機構名稱（填寫後將覆蓋網頁上的機構名稱設定） | ❌ | XX 社會福利基金會 |

> **Excel 使用者注意**：請在 Excel 中選擇 **「另存新檔 → CSV UTF-8 (逗號分隔)」** 以避免中文亂碼問題。

## Self-Deployment

由於本專案為純前端（靜態網頁）架構，您可以非常輕鬆地將其部署在自己的環境或本地端。

### 方法一：GitHub Pages 免費部署 (最推薦)

1. 註冊登入 GitHub，將本專案 Fork 到您的帳號下，或是自行上傳程式碼到您新建的 Repository。
2. 進入該 Repository 的頁面，點選上方的 **Settings** 標籤，然後在左側選單找到 **Pages**。
3. 在 "Build and deployment" (或 Source) 設定中，將 Branch 選擇為 `main` (或 `master`)，然後點擊 **Save**。
4. 等待約 1~2 分鐘，GitHub 會自動幫您部署。完成後可透過 `https://<你的帳號>.github.io/<repo名稱>/` 永久存取此工具。

> 也可使用 Cloudflare Pages 部署，步驟類似。

### 方法二：本機伺服器執行

由於瀏覽器有跨網域安全限制（CORS）以及字體動態載入的需求，**請勿直接雙擊 `index.html` 打開**。您必須透過 HTTP Server 來運行它：

**使用 Python (若是 macOS / Linux 通常內建):**
```bash
# 1. 終端機進入專案資料夾
cd receipt-generator

# 2. 啟動伺服器
python3 -m http.server 8080
```
然後在瀏覽器網址列輸入: `http://localhost:8080`

**使用 Node.js / npm:**
```bash
# 1. 終端機進入專案資料夾
cd receipt-generator

# 2. 執行 serve (無須先安裝，npx 會自行動態下載並執行)
npx serve .
```
然後在瀏覽器網址列輸入: `http://localhost:3000`

## 技術架構與使用工具

*   **核心技術**：HTML5, CSS3, 原生 JavaScript (Vanilla JS)
*   **PDF 渲染生成**：[pdfmake](https://pdfmake.github.io/docs/)
*   **CSV 解析**：[PapaParse](https://www.papaparse.com/)
*   **ZIP 壓縮打包**：[JSZip](https://stuk.github.io/jszip/)

---

## 注意事項

- 為了避免您的瀏覽器記憶體不足而卡頓或崩潰，建議**單次匯入處理 100 筆以內**的資料。
- 支援現代主流瀏覽器：Chrome 89+、Edge 88+、Firefox 86+、Safari 14+。
- 隱私保護保證：本專案**無任何後端伺服器或資料庫**，所有操作皆為暫存。當頁面重整、關閉或換頁後，所有匯入的資料將會立即清空，請安心使用。

---

## 授權

MIT License
