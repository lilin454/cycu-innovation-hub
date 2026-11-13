# 中原大學創新創業發展社｜活動公告平台

CYCU Innovation & Entrepreneurship Development Club — 官方公告與活動資訊平台。

一套完整的全端系統：公開的前台網站 + 需要登入的後台 CMS + PostgreSQL 資料庫。
社團幹部不需要會寫程式，就能新增、編輯、排程發布、複製公告，並一鍵複製適合貼到 LINE 的轉傳文案。

---

## 功能總覽

**前台（不需登入）**

- 首頁：品牌主視覺、下一場活動、精選活動、最新公告、分類入口
- 搜尋與交叉篩選：關鍵字 ×「活動來源」×「活動類型」×「費用」，並可依發布時間／活動日期排序、分頁
  （全部以網址參數查詢資料庫，篩選結果的網址可以直接分享）
- 公告詳細頁 `/a/<短代稱>`：活動資訊、富文字內文、活動圖片、附件下載、聯絡資訊、相關活動
- 分享：複製網址、一鍵複製轉傳文案、LINE、Facebook、裝置原生分享
- SEO：每則公告有自己的 title / description / Open Graph / canonical / Event 結構化資料
- 404、空資料、搜尋無結果、圖片載入失敗、系統錯誤都有對應畫面
- 完整 RWD（手機、平板、桌面）

**後台 `/admin`（需登入）**

- 總覽：各狀態公告數量、即將舉辦、最近更新、等待自動發布
- 公告管理：搜尋、依狀態／分類／費用篩選、排序、分頁；編輯、預覽、複製公告、複製網址、複製分享文案、置頂、精選、下架、封存、刪除（有確認視窗）
- 公告編輯器（A–H 八個區塊＋側邊目錄）：基本資訊、分類與標籤、活動資訊、富文字內文（標題、粗斜底線、文字顏色、清單、引言、分隔線、連結、圖片、表格）、圖片與附件（上傳、排序、改名、刪除）、聯絡與邀請、分享設定（自訂文案＋變數＋即時預覽）、發布設定
- 公告生命週期：草稿 → 已排程 → 已發布 → 已下架 → 已封存
- 預定發布：到指定時間會**自動**發布（見下方「排程發布如何運作」）
- 分類管理：活動來源／活動類型／自訂標籤的新增、改名、換色、排序、刪除（使用中的分類刪除前會提醒）
- 系統設定：網站名稱、Logo、首頁標語與簡介、社群連結、聯絡方式、頁尾文字、變更密碼

---

## 技術架構

| 項目 | 使用技術 |
| --- | --- |
| 框架 | Next.js 15（App Router）＋ React 19 ＋ TypeScript |
| 後端 | Next.js Server Actions ＋ Route Handlers |
| 樣式 | Tailwind CSS v4（品牌色彩系統定義在 `src/app/globals.css`） |
| 資料庫 | PostgreSQL ＋ Prisma ORM |
| 登入驗證 | 自行實作：bcrypt 密碼雜湊 ＋ 資料庫 Session ＋ HttpOnly Cookie |
| 富文字編輯器 | Tiptap v2 |
| 表單驗證 | Zod（伺服器端） |
| 內容消毒 | sanitize-html（儲存時與輸出時各做一次） |
| 檔案儲存 | 本機磁碟（預設）或 S3 相容物件儲存 |

## 專案資料夾結構

```
├─ prisma/
│  ├─ schema.prisma            資料模型（User / Session / Announcement / Category / Attachment …）
│  ├─ migrations/              資料庫遷移檔
│  └─ seed.ts                  建立預設分類（加 --demo 會建立示範公告）
├─ scripts/
│  ├─ dev-db.mjs               本機開發用 PostgreSQL（免安裝 Docker）
│  └─ create-admin.ts          建立／重設管理員帳號
├─ public/brand/               Logo 與合作單位標誌
├─ brand-assets/               原始品牌素材（備份用）
├─ src/
│  ├─ middleware.ts            未登入不得進入 /admin
│  ├─ instrumentation.ts       伺服器內建排程（每 30 秒檢查預定發布）
│  ├─ app/
│  │  ├─ (site)/               前台：首頁、/announcements、/categories、/about、/a/[slug]
│  │  ├─ admin/
│  │  │  ├─ login/             登入頁
│  │  │  ├─ (panel)/           後台各頁（總覽、公告、分類、設定）
│  │  │  └─ actions.ts         所有後台操作（Server Actions，皆驗證登入）
│  │  ├─ api/admin/upload/     檔案上傳 API
│  │  ├─ api/cron/publish/     給外部 Cron 呼叫的排程端點
│  │  ├─ files/[...key]/       圖片與檔案輸出
│  │  ├─ download/[id]/        附件下載（保留原始檔名、檢查發布狀態）
│  │  ├─ not-found.tsx / error.tsx
│  │  └─ globals.css           品牌色彩、字體、元件樣式
│  ├─ components/
│  │  ├─ site/                 前台元件（導覽列、公告列、篩選器、分享列、詳細頁）
│  │  └─ admin/                後台元件（編輯器、富文字、列表操作、分類管理、設定）
│  └─ lib/                     auth、storage、sanitize、share（分享文案）、format（日期費用）、validation …
└─ .env.example                環境變數範本
```

---

## 快速開始（本機開發）

需要：Node.js 20 以上。**不需要**另外安裝 PostgreSQL 或 Docker。

```bash
npm install
```

```bash
cp .env.example .env
```

打開 `.env`，至少修改 `ADMIN_PASSWORD`（10 碼以上）。其餘保持預設即可在本機執行。

開一個終端機視窗啟動本機資料庫（保持開著）：

```bash
npm run db:start
```

再開另一個終端機，建立資料表、預設分類與第一位管理員：

```bash
npm run setup
```

（想先看看版面，可以再執行 `npm run db:seed -- --demo` 建立三則示範公告。）

啟動網站：

```bash
npm run dev
```

- 前台：<http://localhost:3000>
- 後台：<http://localhost:3000/admin>（帳號密碼為 `.env` 中的 `ADMIN_ACCOUNT` / `ADMIN_PASSWORD`）

> Next.js 的前端與後端是同一個程式，`npm run dev` 一個指令就同時啟動兩者。

### 環境變數說明

| 變數 | 說明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `SITE_URL` | 網站對外網址，用來產生分享連結與社群預覽。正式環境**務必**設定成實際網域（`https://…`），設定為 https 時登入 Cookie 會自動加上 Secure |
| `ADMIN_ACCOUNT` / `ADMIN_PASSWORD` / `ADMIN_DISPLAY_NAME` | 只在執行 `npm run admin:create` 時讀取，建立完成後可以把密碼從 `.env` 清掉 |
| `CRON_SECRET` | 外部 Cron 呼叫 `/api/cron/publish` 時的密鑰（Serverless 部署才需要） |
| `STORAGE_DRIVER` | `local`（預設）或 `s3` |
| `UPLOAD_DIR` | 本機儲存的資料夾，預設 `./uploads` |
| `S3_*` | S3 相容儲存的連線資訊 |

`.env` 已列在 `.gitignore`，不會被提交到 Git。

### 管理員帳號

- **建立第一位管理員**：在 `.env` 設定帳號密碼後執行 `npm run admin:create`
- **新增其他管理員**：把 `.env` 的 `ADMIN_ACCOUNT` 改成新帳號、設定密碼，再執行一次 `npm run admin:create`
- **忘記密碼**：對同一個帳號再執行一次 `npm run admin:create` 就會重設密碼，並登出該帳號的所有裝置
- **平常改密碼**：登入後到「系統設定」最下方
- 系統沒有公開註冊功能

### 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 開發模式 |
| `npm run build` / `npm start` | 正式建置／啟動 |
| `npm run lint` / `npm run typecheck` | 程式碼檢查 |
| `npm run db:start` | 啟動本機開發用 PostgreSQL |
| `npm run db:migrate` | 套用資料庫遷移 |
| `npm run db:seed` | 建立預設分類（可重複執行） |
| `npm run db:studio` | 開啟 Prisma Studio 直接檢視資料 |
| `npm run admin:create` | 建立／重設管理員 |

---

## 如何測試主要流程

1. **發布活動**：登入後台 → 新增公告 → 填標題、上傳封面、選分類、填活動時間、寫內文、上傳簡章 PDF → 「儲存並預覽」→「立即發布」。發布後到前台首頁就會看到。
2. **轉傳到 LINE**：公告管理 → 該公告的「操作」→「複製分享文案」（或「複製網址」）→ 貼到 LINE。前台每則公告頁面也有「一鍵複製轉傳文案」。
3. **發布相似活動**：公告管理 →「操作」→「複製公告」→ 系統建立一則新的草稿（新的 ID 與新的網址，原公告不受影響）並直接進入編輯頁 → 修改日期與報名連結 → 發布。
4. **訪客找免費競賽**：前台 → 點「競賽」→ 點「免費」→ 只會列出同時符合的活動。
5. **預定發布**：編輯公告 → 發布設定 → 設定未來的時間 →「設定排程」。時間到後不需要任何操作，公告就會出現在前台。
6. **權限**：登出後直接開 `/admin/…` 會被導回登入頁；草稿、已排程、已下架的公告從前台網址打開一律是 404。

### 分享文案的變數

在「自訂分享文案」中可以使用：`{標題}` `{摘要}` `{活動時間}` `{活動地點}` `{費用}` `{活動對象}` `{報名截止}` `{報名連結}` `{短連結}`。
沒有填自訂文案時，系統會依公告資料自動組成（有填「對外邀請文案」時會用它取代摘要）。

---

## 排程發布如何運作

預定發布不是只存一個時間而已，有三層機制確保真的會執行：

1. **伺服器內建排程**（`src/instrumentation.ts`）：網站啟動後每 30 秒檢查一次，把到期的「已排程」公告改成「已發布」。適用於長時間執行的 Node 伺服器（`npm start`、Docker、Railway、Render、Zeabur、VPS）。
2. **外部 Cron 端點**：`GET /api/cron/publish`，Header 帶 `Authorization: Bearer <CRON_SECRET>`。Serverless 平台沒有常駐程式，請用這個。
3. **讀取時檢查**：前台每次讀取公告前也會先檢查一次，作為最後保險。

---

## 部署到正式環境

### 方案 A（建議）：可常駐的 Node 主機＋持久磁碟

例如 Railway、Render、Zeabur、Fly.io 或自己的 VPS。優點是排程內建、檔案可以直接存在磁碟上，設定最少。

1. 建立一個 PostgreSQL 資料庫，取得連線字串。
2. 設定環境變數：`DATABASE_URL`、`SITE_URL=https://你的網域`、`STORAGE_DRIVER=local`、`UPLOAD_DIR=/data/uploads`（指向掛載的持久磁碟）。
3. 建置與啟動指令：

```bash
npm ci && npm run build
```

```bash
npm run db:migrate && npm run db:seed && npm start
```

4. 第一次部署後，在主機上（或用平台的一次性指令）設定 `ADMIN_ACCOUNT`、`ADMIN_PASSWORD` 後執行：

```bash
npm run admin:create
```

> 注意：如果平台的磁碟不是持久的（每次部署都會清空），上傳的圖片與附件會消失，請改用方案 B 的 S3 儲存。

### 方案 B：Serverless（Vercel 等）

需要另外準備三項外部服務：

| 需求 | 建議服務 | 設定 |
| --- | --- | --- |
| PostgreSQL | Neon、Supabase | `DATABASE_URL` |
| 物件儲存 | Cloudflare R2、AWS S3 | `STORAGE_DRIVER=s3` 與 `S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`（Bucket 保持私有即可，檔案由網站代為輸出） |
| 排程 | cron-job.org、GitHub Actions、平台內建 Cron | 每 1–5 分鐘呼叫 `https://你的網域/api/cron/publish`，Header：`Authorization: Bearer <CRON_SECRET>` |

資料表與管理員可以在自己的電腦上對正式資料庫執行一次（把 `.env` 的 `DATABASE_URL` 暫時換成正式資料庫）：

```bash
npm run setup
```

已知限制：Vercel 的函式請求大小上限約 4.5MB，超過的附件無法上傳。若常需要上傳較大的簡章，請用方案 A。

### 需要另外配置的外部服務整理

- **PostgreSQL**：正式環境一定要（本機開發已內建）
- **S3 相容儲存**：只有在主機沒有持久磁碟時需要
- **外部 Cron**：只有 Serverless 部署時需要
- **Google Fonts**：字體由訪客的瀏覽器直接向 Google 載入，不需設定；載入失敗時自動改用系統字體

---

## 安全性設計

- 密碼以 bcrypt（cost 12）雜湊儲存；Session 權杖只存 SHA-256 雜湊，Cookie 為 HttpOnly＋SameSite=Lax（https 時加 Secure）
- 登入失敗限制：同一帳號 15 分鐘內錯 5 次、同一 IP 錯 20 次即暫時鎖定
- 後台每一個頁面、每一個 Server Action、上傳 API 都在伺服器端驗證 Session，不是只隱藏按鈕
- 後台頁面一律 `Cache-Control: no-store`，登出後按上一頁不會看到舊畫面
- 上傳檔案檢查副檔名、MIME Type、大小（圖片 8MB／附件 20MB）與檔頭內容；不接受 SVG 與可執行檔；儲存檔名為隨機值
- 富文字內容以白名單消毒，移除 script、事件屬性、`javascript:` 連結、iframe 與任意樣式
- 所有資料庫查詢經由 Prisma 參數化；所有輸入以 Zod 在伺服器端驗證
- 未發布公告的頁面與附件，訪客無法透過修改網址取得

---

## 重要假設與設計決定

- **公告網址**採用 `/a/<7 碼隨機代稱>`，建立時產生，修改標題不會改變；管理者可在編輯頁手動改成好記的代稱（發布後不建議再改）。
- **時間**一律以台灣時間（UTC+8）輸入與顯示。
- **篩選邏輯**：不同分類之間是「且」（來源 × 類型 × 費用），同一分類內多選是「或」。
- **費用**是獨立欄位（免費／付費／保證金／依活動內容而定），不是標籤。
- **精選活動**首頁最多顯示 3 則；**置頂**公告在「最新發布」排序時排在最前面。
- **重新發布**已下架的公告時會保留原本的發布時間。
- **刪除分類**不會刪除公告，只會把該標籤從公告上移除。
- **複製公告**時圖片與附件是共用同一份實體檔案；只有在沒有任何公告引用時才會真的刪除檔案。
- 上傳後沒有儲存就離開編輯頁的檔案會留在儲存空間中（不影響使用）。
- 合作單位標誌（青年局、創發中心、台北校友會等）僅用於「關於」頁說明活動資訊來源；如需調整請修改 `src/app/(site)/about/page.tsx`。
- 示範公告（標題有【示範公告】）只是展示版面用，正式使用前請在後台刪除。
