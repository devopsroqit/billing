import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

// The next unused device ID, atomically. Call this inside a
// prisma.$transaction so that reading + incrementing the counter and creating
// the device are one operation — otherwise two concurrent device creates
// could both read `nextSeq = 42`, both create ROQIT_042, and the DB's
// @unique on assetTag would reject the second one.
//
// `tx` accepts the Prisma transaction client OR the top-level `prisma` — a
// standalone call is fine for scripts and one-offs where there's no
// concurrent contention.
//
// Format:  ROQIT_ + 3-digit zero-padded number (ROQIT_001 … ROQIT_999).
// Past 999 the number naturally widens to four digits (ROQIT_1000).

type Tx = PrismaClient | Prisma.TransactionClient;

export async function getNextDeviceId(tx: Tx): Promise<string> {
  // Ensure the singleton counter row exists. `upsert` is safe — if the row
  // is already there, `update: {}` is a no-op; if it's the very first run,
  // we create it starting at 1.
  await tx.deviceIdCounter.upsert({
    where: { id: 1 },
    create: { id: 1, nextSeq: 1 },
    update: {},
  });
  // Atomic post-increment: read the current nextSeq, then bump it.
  // We use `increment` so the DB does the arithmetic — no read-modify-write
  // race between two Node handlers.
  const row = await tx.deviceIdCounter.update({
    where: { id: 1 },
    data: { nextSeq: { increment: 1 } },
    select: { nextSeq: true },
  });
  // At this point row.nextSeq is the NEXT one; the number we hand out for
  // THIS device is (nextSeq - 1). Example: row starts at 1, we increment
  // to 2, we hand out 1 → ROQIT_001. Next call bumps to 3, hands out 2, etc.
  const seq = row.nextSeq - 1;
  return formatDeviceId(seq);
}

export function formatDeviceId(seq: number): string {
  return `ROQIT_${String(seq).padStart(3, "0")}`;
}

/**
 * Parse a Device ID back to its sequence number. Returns null when the
 * string doesn't match `ROQIT_<digits>` — used by the one-off migration
 * script to figure out whether a device's current ID has a numeric suffix
 * we can preserve.
 */
export function parseDeviceIdSeq(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^ROQIT[_-]?(?:[A-Z]+[_-])?(\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
