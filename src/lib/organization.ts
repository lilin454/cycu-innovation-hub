import "server-only";
import { all } from "./db";
import type { Officer, Org, OrgKind } from "./organization-types";

export async function listOfficers(): Promise<Officer[]> {
  try {
    return await all<Officer>(`SELECT "id", "role", "name", "photoUrl" FROM "Officer" ORDER BY "sortOrder", "createdAt"`);
  } catch {
    // 資料表還沒建立（尚未套用 migration）時不要讓整頁壞掉
    return [];
  }
}

export async function listOrgs(kind?: OrgKind): Promise<Org[]> {
  try {
    return await all<Org>(
      `SELECT "id", "kind", "name", "logoUrl", "linkUrl" FROM "Organization"
       ${kind ? `WHERE "kind" = ?` : ""} ORDER BY "kind", "sortOrder", "createdAt"`,
      ...(kind ? [kind] : []),
    );
  } catch {
    return [];
  }
}

/** 連結是站內路徑（/ 開頭）就在同一個分頁開啟，外部網址開新分頁 */
export function isExternal(href: string | null): boolean {
  return Boolean(href && /^https?:\/\//i.test(href));
}
