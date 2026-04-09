import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "lhq_admin";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/api/admin")) return NextResponse.next();

  const cookieValue = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookieValue) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
