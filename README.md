# 中原大學創新創業發展社｜活動公告平台（Cloudflare 免費版）

這是 `cloudflare` 分支：為了能完全跑在 **Cloudflare 免費方案**上而精簡過的版本。
原本的完整版（PostgreSQL、富文字編輯器、一般 Node 主機）保留在 `main` 分支。

## 這個版本用了哪些 Cloudflare 服務（全部免費額度內）

| 用途 | 服務 | 免費額度 |
| --- | --- | --- |
| 網站本體 | Workers（透過 OpenNext 執行 Next.js 15） | 每天 10 萬次請求、每次請求 10 毫秒 CPU、程式壓縮後 3 MiB |
| 資料庫 | D1（SQLite） | 500 MB、每次請求最多 50 次查詢 |
| 圖片與附件 | Workers KV | 總量 1 GB、單檔 25 MB、每天 1,000 次寫入、10 萬次讀取 |
| 排程發布 | Cron Triggers | 每個帳號 5 個 |

不需要綁定信用卡，也不需要任何外部服務。

## 跟完整版（main）的差異

| 項目 | main | cloudflare |
| --- | --- | --- |
| 資料庫 | PostgreSQL + Prisma | D1，直接寫 SQL（參數綁定） |
| 公告內文 | 富文字編輯器（Tiptap） | 文字框＋簡易標記（見下方） |
| 內文中的圖片與表格 | 支援 | 不支援；圖片放「活動圖片」，表格請上傳成附件 |
| 檔案儲存 | 本機磁碟或 S3 | Workers KV |
| 密碼雜湊 | bcrypt | PBKDF2-SHA256（10 萬次，Web Crypto 內建） |
| 預定發布 | 伺服器內建計時器（30 秒） | Cron Trigger（每 5 分鐘）＋讀取公告時檢查 |
| 第一位管理員 | 指令建立 | 用設定好的帳密第一次登入時自動建立 |

其餘功能相同：前台搜尋與交叉篩選、公告詳細頁、分享（複製網址／轉傳文案／LINE／IG 私訊）、競賽獎金、YouTube 內嵌、
後台公告管理、複製公告、排程、置頂與精選、分類管理、系統設定與板塊開關、總管理員／一般管理員權限、管理員帳號管理。

### 內文的簡易標記

```
# 大標題
## 小標題
- 條列清單
1. 編號清單
> 引言
---            （分隔線）
**粗體**
空一行 = 換段；網址會自動變成連結
```

內文一律以文字輸出，不會插入任何 HTML，所以沒有 XSS 的問題。

## 本機開發

需要 Node.js 20 以上。資料庫與檔案儲存由 wrangler 在本機模擬，不用另外安裝。

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

打開 `.dev.vars`，填入 `ADMIN_ACCOUNT` 與 `ADMIN_PASSWORD`（10 碼以上）。

```bash
npm run db:migrate:local
```

```bash
npm run dev
```

- 前台：<http://localhost:3000>
- 後台：<http://localhost:3000/admin>，用 `.dev.vars` 裡的帳密登入，第一次登入會自動建立總管理員。

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 本機開發（含模擬的 D1 與 KV） |
| `npm run lint` / `npm run typecheck` | 程式碼檢查 |
| `npm run preview` | 用真正的 Workers 執行環境在本機預覽 |
| `npm run cf:build` 後 `npm run cf:size` | 建置並顯示 Worker 大小（gzip 要小於 3 MiB） |
| `npm run deploy` | 建置並部署到 Cloudflare |

## 部署到 Cloudflare

1. 登入 Cloudflare（會開啟瀏覽器授權）：

```bash
npx wrangler login
```

2. 建立資料庫與檔案儲存空間，並把指令輸出的 ID 填進 `wrangler.jsonc`（`database_id` 與 kv 的 `id`）：

```bash
npx wrangler d1 create cycu-board
```

```bash
npx wrangler kv namespace create FILES
```

3. 建立資料表與預設分類：

```bash
npm run db:migrate:remote
```

4. 部署：

```bash
npm run deploy
```

5. 設定第一位總管理員的帳號密碼（以密鑰方式儲存，不會出現在程式碼裡）：

```bash
npx wrangler secret put ADMIN_ACCOUNT
```

```bash
npx wrangler secret put ADMIN_PASSWORD
```

6. 打開部署完成後顯示的網址，到 `/admin/login` 用上面的帳密登入。第一次登入會自動建立總管理員；
   之後這兩個密鑰就不再有作用，可以用 `npx wrangler secret delete ADMIN_PASSWORD` 移除。

如果之後綁了自己的網域，請把 `wrangler.jsonc` 裡的 `SITE_URL` 改成 `https://你的網域` 再部署一次（分享連結與社群預覽會用到）。

## 已知限制

- **CPU 時間**：免費方案每次請求只有 10 毫秒 CPU。一般頁面在範圍內，但登入時的密碼雜湊較吃 CPU；
  如果登入出現 Error 1102，請把 `src/lib/auth.ts` 的 `PBKDF2_ITERATIONS` 調低後重新部署，並請所有管理員重設密碼。
- **預定發布的精確度**：Cron 每 5 分鐘執行一次；不過只要有人打開網站，到期的公告就會立刻發布。
- **KV 的寫入次數**：每天 1,000 次，一般社團用量遠低於此。
- **沒有存檔就離開編輯頁**時，已上傳的檔案會留在 KV 中（不影響使用）。
- 一般管理員不能永久刪除公告（可以下架或封存）。

## 專案結構

```
├─ wrangler.jsonc            Cloudflare 設定（D1、KV、Cron、環境變數）
├─ custom-worker.ts          Worker 進入點（網站＋排程發布）
├─ open-next.config.ts       OpenNext 設定
├─ migrations/               D1 資料表與預設分類
├─ cloudflare-env.d.ts       由 `wrangler types` 產生的型別
└─ src/
   ├─ middleware.ts          未登入不得進入 /admin
   ├─ app/                   前台 (site)、後台 admin、上傳 API、檔案輸出
   ├─ components/            前台與後台元件
   └─ lib/
      ├─ db.ts               D1 存取
      ├─ announcements.ts    公告查詢（前台與後台）
      ├─ auth.ts             登入、Session、密碼雜湊、登入失敗鎖定
      ├─ storage.ts          KV 檔案儲存與上傳驗證
      └─ share.ts / format.ts / validation.ts / youtube.ts …
```

## 安全性

- 密碼以 PBKDF2-SHA256 加上每個帳號獨立的隨機 salt 儲存；Session 權杖只存 SHA-256 雜湊，Cookie 為 HttpOnly＋SameSite=Lax（https 時加 Secure）
- 同一帳號 15 分鐘內錯 5 次、同一 IP 錯 20 次即暫時鎖定
- 後台每個頁面、每個操作、上傳 API 都在伺服器端驗證登入與權限
- 上傳檔案檢查副檔名、MIME Type、大小與檔頭；不接受 SVG 與可執行檔
- 所有 SQL 都使用參數綁定；所有輸入以 Zod 在伺服器端驗證
- 未發布公告的頁面與附件，訪客無法透過修改網址取得
