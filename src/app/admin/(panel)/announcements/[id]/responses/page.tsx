import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { all, first } from "@/lib/db";
import { DEFAULT_SURVEY_QUESTION, parseSurveyOptions, type SurveyResponse } from "@/lib/survey";
import { SurveyResponses } from "@/components/admin/SurveyResponses";

export const metadata: Metadata = { title: "問卷回覆" };

// 問卷回覆含有填寫者姓名，只有登入的管理員可以查看
export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) notFound();
  const a = await first<{ id: string; title: string; surveyEnabled: number; surveyQuestion: string | null; surveyOptions: string | null }>(
    `SELECT "id", "title", "surveyEnabled", "surveyQuestion", "surveyOptions" FROM "Announcement" WHERE "id" = ?`,
    id,
  );
  if (!a) notFound();
  const responses = await all<SurveyResponse>(
    `SELECT "id", "announcementId", "name", "answer", "note", "createdAt" FROM "SurveyResponse" WHERE "announcementId" = ? ORDER BY "createdAt" DESC LIMIT 3000`,
    a.id,
  );
  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/admin/announcements/${a.id}`} className="text-sm font-bold underline underline-offset-4">← 回到編輯公告</Link>
      <p className="eyebrow mt-4 text-flame-dark">Survey</p>
      <h1 className="mt-1 text-3xl font-black">問卷回覆</h1>
      <p className="mt-2 font-bold">{a.title}</p>
      <p className="text-sm text-muted">
        題目：{a.surveyQuestion?.trim() || DEFAULT_SURVEY_QUESTION}
        {a.surveyEnabled !== 1 && <span className="ml-2 font-bold text-flame-dark">（問卷目前是關閉的，訪客無法填寫）</span>}
      </p>
      <SurveyResponses title={a.title} options={parseSurveyOptions(a.surveyOptions)} responses={responses} />
    </div>
  );
}
