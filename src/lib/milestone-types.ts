// 活動紀錄的常數與型別（前後端共用，不可引入伺服器端模組）

export const MILESTONE_KINDS = ["AWARD", "VISIT", "EVENT", "OTHER"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];
export const MILESTONE_KIND_LABEL: Record<MilestoneKind, string> = {
  AWARD: "獲獎",
  VISIT: "參訪交流",
  EVENT: "活動成果",
  OTHER: "其他",
};

export const MILESTONE_SUBJECTS = ["CLUB", "OFFICER", "MEMBER"] as const;
export type MilestoneSubject = (typeof MILESTONE_SUBJECTS)[number];
export const MILESTONE_SUBJECT_LABEL: Record<MilestoneSubject, string> = {
  CLUB: "創創社",
  OFFICER: "創創社幹部",
  MEMBER: "創創社社員",
};

export type Milestone = {
  id: string;
  title: string;
  kind: MilestoneKind;
  subject: MilestoneSubject;
  people: string | null;
  /** YYYY-MM-DD */
  occurredOn: string;
  location: string | null;
  content: string;
  coverImage: string | null;
  linkUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  createdAt: string;
  updatedAt: string;
  /** 來自活動公告（在後台「活動紀錄」勾選）時才有，值為公告的網址代稱；公告已下架時為 null */
  fromAnnouncement?: { slug: string | null };
};
