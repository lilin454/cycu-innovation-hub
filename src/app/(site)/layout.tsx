import { SiteShell } from "@/components/site/SiteShell";

// 前台內容全部即時從資料庫讀取，確保發布、下架與排程立即生效
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
