import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// 第一道防線：沒有登入 Cookie 就不讓進後台。
// 真正的 Session 驗證在伺服器端的 requireAdmin()/assertAdmin() 進行（每個頁面與每個操作都會檢查）。
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
