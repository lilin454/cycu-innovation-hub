// 前後端共用的常數（不可引入任何伺服器端模組）

export const FEE_TYPES = ["FREE", "PAID", "DEPOSIT", "VARIES"] as const;
export type FeeTypeKey = (typeof FEE_TYPES)[number];

export const FEE_LABEL: Record<FeeTypeKey, string> = {
  FREE: "免費",
  PAID: "付費",
  DEPOSIT: "保證金",
  VARIES: "依活動內容而定",
};

export const FEE_SLUG: Record<FeeTypeKey, string> = {
  FREE: "free",
  PAID: "paid",
  DEPOSIT: "deposit",
  VARIES: "varies",
};

export const STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;
export type StatusKey = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<StatusKey, string> = {
  DRAFT: "草稿",
  SCHEDULED: "已排程",
  PUBLISHED: "已發布",
  UNPUBLISHED: "已下架",
  ARCHIVED: "已封存",
};

export const KIND_LABEL = {
  SOURCE: "活動來源",
  EVENT_TYPE: "活動類型",
  TAG: "自訂標籤",
} as const;
export type KindKey = keyof typeof KIND_LABEL;

export const SORTS = {
  latest: "最新發布",
  event_asc: "活動日期：由近到遠",
  event_desc: "活動日期：由遠到近",
} as const;
export type SortKey = keyof typeof SORTS;

export const SESSION_COOKIE = "cb_session";

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const FILE_MAX_BYTES = 20 * 1024 * 1024;
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif";
export const FILE_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.zip,.jpg,.jpeg,.png,.webp";
