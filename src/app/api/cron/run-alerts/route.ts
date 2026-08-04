import { NextRequest, NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts";
import { flushOutbox } from "@/lib/email";

// Public-ish endpoint for an external scheduler (cron, GitHub Action, Vercel Cron)
// to trigger the alert run. Protect it with a shared secret in CRON_SECRET.
//
// Vercel Cron calls this with an `Authorization: Bearer <CRON_SECRET>` header,
// which is the primary auth path. For manual/curl triggers a `?key=SECRET`
// query param is also accepted. If CRON_SECRET is unset the route is open
// (fine for local development).
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest, required: string): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  if (bearer && bearer === required) return true;
  const key = req.nextUrl.searchParams.get("key");
  return key === required;
}

export async function GET(req: NextRequest) {
  const required = process.env.CRON_SECRET;
  if (required && !isAuthorized(req, required)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const alerts = await runAlerts();
  const flush = await flushOutbox();
  return NextResponse.json({ ok: true, ...alerts, ...flush });
}
