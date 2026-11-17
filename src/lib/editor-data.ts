import "server-only";
import { listCategories } from "./announcements";
import type { AnnouncementDetail } from "./types";
import { toInputValue } from "./format";
import { defaultSurveyQuestions, resolveSurveyQuestions } from "./survey";
import type { EditorCategory, EditorInitial } from "@/components/admin/AnnouncementEditor";

export async function getEditorCategories(): Promise<EditorCategory[]> {
  const cats = await listCategories(["SOURCE", "EVENT_TYPE"]);
  return cats.map((c) => ({ id: c.id, kind: c.kind as "SOURCE" | "EVENT_TYPE", name: c.name, color: c.color }));
}

export function emptyInitial(slug: string): EditorInitial {
  return {
    title: "", subtitle: "", summary: "", slug, coverImage: "", content: "",
    categoryIds: [], customTags: [], feeType: "FREE", feeAmount: null, feeDescription: "",
    startAt: "", endAt: "", registrationDeadline: "", location: "", organizer: "", coOrganizer: "",
    targetAudience: "", registrationUrl: "", registrationMethod: "",
    contactName: "", contactEmail: "", contactPhone: "", contactLine: "", contactOther: "",
    invitationText: "", customShareText: "", youtubeUrl: "", prize: "",
    surveyEnabled: false, surveyQuestions: defaultSurveyQuestions(), isFeatured: false, isPinned: false, scheduledAt: "",
    attachments: [], images: [],
    status: "DRAFT", publishedAt: null, updatedAt: null,
  };
}

export function toInitial(a: AnnouncementDetail): EditorInitial {
  return {
    title: a.title,
    subtitle: a.subtitle ?? "",
    summary: a.summary ?? "",
    slug: a.slug,
    coverImage: a.coverImage ?? "",
    content: a.content,
    categoryIds: a.categories.filter((c) => c.kind !== "TAG").map((c) => c.id),
    customTags: a.categories.filter((c) => c.kind === "TAG").map((c) => c.name),
    feeType: a.feeType,
    feeAmount: a.feeAmount,
    feeDescription: a.feeDescription ?? "",
    startAt: toInputValue(a.startAt),
    endAt: toInputValue(a.endAt),
    registrationDeadline: toInputValue(a.registrationDeadline),
    location: a.location ?? "",
    organizer: a.organizer ?? "",
    coOrganizer: a.coOrganizer ?? "",
    targetAudience: a.targetAudience ?? "",
    registrationUrl: a.registrationUrl ?? "",
    registrationMethod: a.registrationMethod ?? "",
    contactName: a.contactName ?? "",
    contactEmail: a.contactEmail ?? "",
    contactPhone: a.contactPhone ?? "",
    contactLine: a.contactLine ?? "",
    contactOther: a.contactOther ?? "",
    invitationText: a.invitationText ?? "",
    customShareText: a.customShareText ?? "",
    youtubeUrl: a.youtubeUrl ?? "",
    prize: a.prize ?? "",
    surveyEnabled: a.surveyEnabled,
    // 還沒開過問卷的公告，打開時先帶入預設題目
    surveyQuestions: a.surveyEnabled || a.surveyQuestions ? resolveSurveyQuestions(a) : defaultSurveyQuestions(),
    isFeatured: a.isFeatured,
    isPinned: a.isPinned,
    scheduledAt: toInputValue(a.scheduledAt),
    attachments: a.attachments.map((f) => ({
      fileUrl: f.fileUrl,
      fileName: f.fileName,
      displayName: f.displayName,
      fileType: f.fileType,
      fileSize: f.fileSize,
    })),
    images: a.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
    status: a.status,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    updatedAt: a.updatedAt.toISOString(),
  };
}
