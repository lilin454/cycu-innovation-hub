import "server-only";
import { all, first } from "./db";
import { MILESTONE_KINDS, MILESTONE_SUBJECTS, type Milestone, type MilestoneKind, type MilestoneSubject } from "./milestone-types";

// 活動紀錄：創創社、幹部與社員過往的獲獎、參訪與活動成果

export type MilestoneFilters = { kind: MilestoneKind | null; subject: MilestoneSubject | null };

export function parseMilestoneFilters(sp: Record<string, string | string[] | undefined>): MilestoneFilters {
  const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").toUpperCase();
  const kind = one(sp.kind);
  const subject = one(sp.who);
  return {
    kind: (MILESTONE_KINDS as readonly string[]).includes(kind) ? (kind as MilestoneKind) : null,
    subject: (MILESTONE_SUBJECTS as readonly string[]).includes(subject) ? (subject as MilestoneSubject) : null,
  };
}

type RecordAnnouncementRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  coverImage: string | null;
  status: string;
  startAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 台北時間的日期（YYYY-MM-DD） */
const taipeiDay = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10);

/** 在後台勾選「顯示在活動紀錄」的活動公告，轉成活動紀錄的格式（類型＝活動成果、對象＝創創社） */
function announcementToMilestone(a: RecordAnnouncementRow): Milestone {
  return {
    id: `a-${a.id}`,
    title: a.title,
    kind: "EVENT",
    subject: "CLUB",
    people: null,
    occurredOn: taipeiDay(a.startAt ?? a.publishedAt ?? a.createdAt),
    location: a.location,
    content: a.summary ?? "",
    coverImage: a.coverImage,
    linkUrl: null,
    status: "PUBLISHED",
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    fromAnnouncement: { slug: a.status === "PUBLISHED" ? a.slug : null },
  };
}

const RECORD_COLUMNS = `"id", "slug", "title", "summary", "location", "coverImage", "status", "startAt", "publishedAt", "createdAt", "updatedAt"`;

export async function listPublicMilestones(f: MilestoneFilters, limit = 200): Promise<Milestone[]> {
  const [own, fromAnn] = await Promise.all([listOwnMilestones(f, limit), listRecordAnnouncements(f, limit)]);
  return [...own, ...fromAnn]
    .sort((x, y) => (x.occurredOn === y.occurredOn ? y.createdAt.localeCompare(x.createdAt) : y.occurredOn.localeCompare(x.occurredOn)))
    .slice(0, limit);
}

async function listRecordAnnouncements(f: MilestoneFilters, limit: number): Promise<Milestone[]> {
  if ((f.kind && f.kind !== "EVENT") || (f.subject && f.subject !== "CLUB")) return [];
  const rows = await all<RecordAnnouncementRow>(
    `SELECT ${RECORD_COLUMNS} FROM "Announcement"
     WHERE "showInRecords" = 1 AND "status" IN ('PUBLISHED', 'UNPUBLISHED', 'ARCHIVED')
     ORDER BY COALESCE("startAt", "publishedAt", "createdAt") DESC LIMIT ?`,
    limit,
  );
  return rows.map(announcementToMilestone);
}

/** 後台：可以加入活動紀錄的公告（已結束、已下架或已封存的活動） */
export type RecordCandidate = {
  id: string;
  slug: string;
  title: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  showInRecords: number;
  autoUnpublishedAt: string | null;
};

export async function listRecordCandidates(): Promise<RecordCandidate[]> {
  const now = new Date();
  return all<RecordCandidate>(
    `SELECT "id", "slug", "title", "status", "startAt", "endAt", "location", "showInRecords", "autoUnpublishedAt" FROM "Announcement"
     WHERE "showInRecords" = 1
        OR "status" IN ('UNPUBLISHED', 'ARCHIVED')
        OR ("status" = 'PUBLISHED' AND (("endAt" IS NOT NULL AND "endAt" <= ?) OR ("endAt" IS NULL AND "startAt" IS NOT NULL AND "startAt" <= ?)))
     ORDER BY COALESCE("startAt", "publishedAt", "createdAt") DESC LIMIT 300`,
    now.toISOString(),
    now.toISOString(),
  );
}

async function listOwnMilestones(f: MilestoneFilters, limit: number): Promise<Milestone[]> {
  const where = [`"status" = 'PUBLISHED'`];
  const params: (string | number)[] = [];
  if (f.kind) {
    where.push(`"kind" = ?`);
    params.push(f.kind);
  }
  if (f.subject) {
    where.push(`"subject" = ?`);
    params.push(f.subject);
  }
  return all<Milestone>(
    `SELECT * FROM "Milestone" WHERE ${where.join(" AND ")} ORDER BY "occurredOn" DESC, "createdAt" DESC LIMIT ?`,
    ...params,
    limit,
  );
}

export async function listAdminMilestones(): Promise<Milestone[]> {
  return all<Milestone>(`SELECT * FROM "Milestone" ORDER BY "occurredOn" DESC, "createdAt" DESC LIMIT 500`);
}

export async function getMilestone(id: string): Promise<Milestone | null> {
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return null;
  return first<Milestone>(`SELECT * FROM "Milestone" WHERE "id" = ?`, id);
}
