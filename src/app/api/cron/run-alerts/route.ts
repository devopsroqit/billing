import { NextRequest, NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts";
import { flushOutbox } from "@/lib/email";

// Public-ish endpoint for an external scheduler (cron, GitHub Action, Vercel Cron)
// to trigger the alert run. Protect it with a shared secret:
//   GET /api/cron/run-alerts?key=YOUR_SECRET
// Set CRON_SECRET in the environment to require the key. If unset, it is open
// (fine for local development).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const required = process.env.CRON_SECRET;
  if (required) {
    const key = req.nextUrl.searchParams.get("key");
    if (key !== required) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const alerts = await runAlerts();
  const flush = await flushOutbox();
  return NextResponse.json({ ok: true, ...alerts, ...flush });
}
