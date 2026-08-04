import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "roqit_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

// Runs on the edge before every request. Redirects unauthenticated users to
// /login and keeps logged-in users away from the login page.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (!valid && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (valid && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, the alert cron, and static asset
  // files (images/icons in public/) — otherwise the auth redirect would block
  // the logo and other public assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)",
  ],
};
