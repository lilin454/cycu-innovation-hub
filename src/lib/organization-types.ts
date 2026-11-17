export type Officer = { id: string; role: string; name: string; photoUrl: string | null };

export const ORG_KINDS = ["PARTNER", "SOURCE"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];
export const ORG_KIND_LABEL: Record<OrgKind, string> = { PARTNER: "合作單位", SOURCE: "活動資訊來源" };

export type Org = { id: string; kind: OrgKind; name: string; logoUrl: string | null; linkUrl: string | null };

/** 合作單位、資訊來源要顯示在哪裡 */
export const PLACEMENTS = ["about", "footer", "both", "none"] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const PLACEMENT_LABEL: Record<Placement, string> = {
  about: "只在「關於創創社」",
  footer: "只在網站最下方",
  both: "兩個地方都顯示",
  none: "暫時不顯示",
};
export const inAbout = (p: string) => p === "about" || p === "both";
export const inFooter = (p: string) => p === "footer" || p === "both";
