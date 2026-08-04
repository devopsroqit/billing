import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public health check — open it in a browser to confirm the backend is live and
// the database is reachable:  https://YOUR-APP.vercel.app/api/health
//   { ok: true }  → backend up + database connected (and seeded)
//   { ok: false } → backend up, but the database call failed (see "error")
export const dynamic = "force-dynamic";

export async function GET() {
  const time = new Date().toISOString();
  const authSecretSet = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);

  try {
    const users = await prisma.user.count();
    return NextResponse.json({
      ok: true,
      backend: "up",
      database: "connected",
      seeded: users > 0,
      authSecretConfigured: authSecretSet,
      time,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        backend: "up",
        database: "error",
        authSecretConfigured: authSecretSet,
        error: e instanceof Error ? e.message : String(e),
        time,
      },
      { status: 500 },
    );
  }
}
