import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getBaseUrl } from "@/lib/settings";
import { listApiTokens } from "@/lib/api-token";
import { buildAiPrompt } from "@/lib/ai-prompt";
import { AiTokenManager, PromptBox } from "@/components/admin/AiImportPanel";

export const metadata: Metadata = { title: "AI 匯入" };

export default async function AiImportPage() {
  await requireOwner();
  const [base, tokens] = await Promise.all([getBaseUrl(), listApiTokens()]);
  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow text-flame-dark">AI import</p>
      <h1 className="mt-1 text-3xl font-black">AI 匯入</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        讓 AI 讀活動簡章、海報後自動建立公告。這裡是預留的接口：建立 API 金鑰、把下方提示詞交給 AI，AI 就能透過 API 上傳檔案並新增公告。
        只有總管理員能使用，所有公告預設存成草稿。
      </p>

      <section className="panel mt-6">
        <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">接口一覽</h2>
        <ul className="divide-y divide-line text-sm">
          {[
            ["GET", "/api/ai", "確認金鑰、取得分類名稱與欄位限制"],
            ["GET", "/api/ai/announcements?q=關鍵字", "查最近的公告，避免重複上架"],
            ["POST", "/api/ai/files", "上傳海報、活動圖片或附件"],
            ["POST", "/api/ai/announcements", "新增公告（預設草稿）"],
          ].map(([m, path, desc]) => (
            <li key={path} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className={`w-12 text-center text-xs font-bold ${m === "GET" ? "bg-navy text-paper" : "bg-flame text-white"}`}>{m}</span>
              <code className="break-all font-bold">{base}{path}</code>
              <span className="text-muted">{desc}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          驗證方式：標頭 Authorization: Bearer &lt;金鑰&gt;。已登入的總管理員在這個網站上也能直接呼叫，供之後在後台內建「上傳檔案給 AI」使用。
        </p>
      </section>

      <AiTokenManager tokens={tokens} />
      <PromptBox prompt={buildAiPrompt(base)} />

      <section className="panel mt-6 border-dashed">
        <h2 className="border-b-2 border-ink bg-paper-2 px-4 py-2.5 font-black">在後台直接上傳檔案給 AI（尚未開通）</h2>
        <p className="p-4 text-sm text-muted">
          之後會在這裡放一個上傳框：選檔案 → 網站把檔案交給 AI 整理 → 自動建立草稿。開通時需要一組 AI 服務的 API 金鑰（可能需要付費），屆時再請你決定要用哪一家。
        </p>
      </section>
    </div>
  );
}
