# Vercel 轉接專案（cycuinnovation.vercel.app）

這個資料夾是給 Vercel 用的，**裡面沒有網站程式**，只有一個轉接設定。

網站本體、資料庫（D1）與檔案（KV）都在 Cloudflare 上（程式在 `cloudflare` 分支）。
Vercel 的工作只有一件事：把 `https://cycuinnovation.vercel.app` 收到的所有請求，原封不動轉給
Cloudflare Worker，再把回應傳回給訪客。

```
訪客 → cycuinnovation.vercel.app（Vercel）→ cycu-innovation-board.….workers.dev（Cloudflare Worker ＋ D1 ＋ KV）
```

## 為什麼這樣做

網站是一個完整的 Next.js 應用程式，直接使用 Cloudflare 的資料庫與檔案儲存，沒有獨立的「後端 API」可以讓
Vercel 上的前端呼叫。用轉接的方式可以在不搬動任何資料、不改動後端的情況下，使用 `vercel.app` 的網址。

## Vercel 專案設定

| 項目 | 設定 |
| --- | --- |
| Project Name | `cycuinnovation` |
| Root Directory | `vercel-proxy` |
| Framework Preset | Other |
| Build Command / Install Command | 留空（不需要建置） |
| Output Directory | `public` |
| 環境變數 | 不需要 |

## 注意事項

- 更新網站內容或功能時，是在 `cloudflare` 分支執行 `npm run deploy`，**不需要**重新部署 Vercel。
- 如果 Cloudflare Worker 的網址改了，要修改這裡 `vercel.json` 的 `destination`。
- Cloudflare 那邊的 `SITE_URL` 要設成 `https://cycuinnovation.vercel.app`，分享連結與社群預覽才會使用這個網址。
- 原本的 `workers.dev` 網址仍然可以直接使用。
