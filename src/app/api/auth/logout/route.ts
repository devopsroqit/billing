import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function POST(req: Request) {
  logout();
  // 303 See Other → the browser follows with GET (a default 307 would re-POST
  // to /login, which is a GET-only page and returns 405).
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
