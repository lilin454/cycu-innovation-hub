import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { all, first } from "@/lib/db";
import { mapResponse, resolveSurveyQuestions } from "@/lib/survey";
import { SurveyResponses } from "@/components/admin/SurveyResponses";

export const metadata: Metadata = { title: "問卷回覆" };

// 問卷回覆含有填寫者個資，只有登入的管理員可以查看
export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) notFound();
  const a = await first<{ id: string; title: string; surveyEnabled: number; surveyQuestions: string | null; surveyQuestion: string | null; surveyOptions: string | null }>(
    `SELECT "id", "title", "surveyEnabled", "surveyQuestions", "surveyQuestion", "surveyOptions" FROM "Announcement" WHERE "id" = ?`,
    id,
  );
  if (!a) notFound();
  const rows = await all<{ id: string; announcementId: string; name: string; answer: string; note: string | null; answers: string | null; createdAt: string }>(
    `SELECT "id", "announcementId", "name", "answer", "note", "answers", "createdAt" FROM "SurveyResponse" WHERE "announcementId" = ? ORDER BY "createdAt" DESC LIMIT 3000`,
    a.id,
  );
  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/admin/announcements/${a.id}`} className="text-sm font-bold underline underline-offset-4">← 回到編輯公告</Link>
      <p className="eyebrow mt-4 text-flame-dark">Survey</p>
      <h1 className="mt-1 text-3xl font-black">問卷回覆</h1>
      <p className="mt-2 font-bold">{a.title}</p>
      {a.surveyEnabled !== 1 && <p className="text-sm font-bold text-flame-dark">問卷目前是關閉的，訪客無法填寫。</p>}
      <SurveyResponses title={a.title} questions={resolveSurveyQuestions(a)} responses={rows.map(mapResponse)} />
    </div>
  );
}
