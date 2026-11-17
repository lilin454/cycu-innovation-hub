import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listCategories } from "@/lib/announcements";
import { listOfficers, listOrgs } from "@/lib/organization";
import { PLACEMENTS, type Placement } from "@/lib/organization-types";
import { OfficerManager, OrgManager } from "@/components/admin/OrganizationManager";

export const metadata: Metadata = { title: "社團資訊" };

const asPlacement = (v: string, fallback: Placement): Placement => ((PLACEMENTS as readonly string[]).includes(v) ? (v as Placement) : fallback);

export default async function OrganizationPage() {
  await requireOwner();
  const [s, officers, orgs, sources] = await Promise.all([getSettings(), listOfficers(), listOrgs(), listCategories(["SOURCE"])]);
  const sourceLinks = sources.map((c) => ({ name: c.name, href: `/announcements?source=${c.slug}` }));
  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow text-flame-dark">Organization</p>
      <h1 className="mt-1 text-3xl font-black">社團資訊</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        管理顯示在「關於創創社」與網站最下方的幹部、合作單位與活動資訊來源。改完會立刻更新到前台。
      </p>
      <OfficerManager items={officers} />
      <OrgManager kind="PARTNER" items={orgs.filter((o) => o.kind === "PARTNER")} placement={asPlacement(s.partnersPlacement, "both")} sourceLinks={sourceLinks} />
      <OrgManager kind="SOURCE" items={orgs.filter((o) => o.kind === "SOURCE")} placement={asPlacement(s.sourcesPlacement, "about")} sourceLinks={sourceLinks} />
    </div>
  );
}
