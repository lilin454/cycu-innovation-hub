// 資料型別與資料列轉換（D1 回傳的是純字串／數字，這裡轉成應用程式使用的型別）
import type { FeeTypeKey, KindKey, StatusKey } from "./constants";

export type Role = "OWNER" | "EDITOR";

export type Category = { id: string; kind: KindKey; name: string; slug: string; color: string; sortOrder: number };

export type Attachment = {
  id: string;
  announcementId: string;
  fileName: string;
  displayName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  sortOrder: number;
};

export type AnnouncementImage = { id: string; announcementId: string; url: string; alt: string | null; sortOrder: number };

export type Announcement = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content: string;
  coverImage: string | null;
  feeType: FeeTypeKey;
  feeAmount: number | null;
  feeDescription: string | null;
  prize: string | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationDeadline: Date | null;
  location: string | null;
  organizer: string | null;
  coOrganizer: string | null;
  targetAudience: string | null;
  registrationUrl: string | null;
  registrationMethod: string | null;
  youtubeUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLine: string | null;
  contactOther: string | null;
  invitationText: string | null;
  customShareText: string | null;
  status: StatusKey;
  isFeatured: boolean;
  isPinned: boolean;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AnnouncementCard = Announcement & { categories: Category[] };
export type AnnouncementDetail = AnnouncementCard & { attachments: Attachment[]; images: AnnouncementImage[] };

export type AnnouncementRow = Omit<
  Announcement,
  "startAt" | "endAt" | "registrationDeadline" | "scheduledAt" | "publishedAt" | "createdAt" | "updatedAt" | "isFeatured" | "isPinned"
> & {
  startAt: string | null;
  endAt: string | null;
  registrationDeadline: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isFeatured: number;
  isPinned: number;
};

const date = (v: string | null) => (v ? new Date(v) : null);

export function mapAnnouncement(r: AnnouncementRow): Announcement {
  return {
    ...r,
    startAt: date(r.startAt),
    endAt: date(r.endAt),
    registrationDeadline: date(r.registrationDeadline),
    scheduledAt: date(r.scheduledAt),
    publishedAt: date(r.publishedAt),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    isFeatured: r.isFeatured === 1,
    isPinned: r.isPinned === 1,
  };
}
