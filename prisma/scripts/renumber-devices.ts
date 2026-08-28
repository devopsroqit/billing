/**
 * One-off migration: rename every Device.assetTag to the ROQIT_NNN format
 * and seed the DeviceIdCounter so future creates continue from N+1.
 *
 * Usage:
 *   npx tsx prisma/scripts/renumber-devices.ts --dry-run   # preview only, writes nothing
 *   npx tsx prisma/scripts/renumber-devices.ts             # apply
 *
 * How it picks the new number for each device (in order):
 *   1. Preserve existing numeric suffix — ROQIT-GPS-077 → ROQIT_077. Physical
 *      labels showing "077" stay meaningful.
 *   2. If two devices would land on the same number, the older one (by
 *      createdAt, then by cuid) keeps it; the newer gets the next unused
 *      number.
 *   3. Devices with no parseable suffix (empty assetTag or unusual format)
 *      get the next unused number in createdAt order.
 *
 * Atomic: wraps every write in a single prisma.$transaction. Either all
 * devices get their new ID or none do.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inlined from src/lib/deviceId.ts — that file imports "server-only" which
// throws when required from a plain tsx script. Keeping the two helpers here
// avoids the runtime restriction; they're 4 lines each and won't drift.
const formatDeviceId = (seq: number) => `ROQIT_${String(seq).padStart(3, "0")}`;
const parseDeviceIdSeq = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const m = s.match(/^ROQIT[_-]?(?:[A-Z]+[_-])?(\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "[dry-run] no writes will happen" : "[live] renaming devices…");

  const devices = await prisma.device.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, assetTag: true, createdAt: true },
  });
  console.log(`found ${devices.length} device(s)`);

  // Two-pass assignment. Pass 1: everyone who has a parseable suffix claims
  // that number, oldest-first. Pass 2: everyone else fills gaps + tail.
  const claimed = new Map<number, string>(); // seq → device.id
  const assigned = new Map<string, number>(); // device.id → seq

  // Pass 1: claim numeric suffix if free
  for (const d of devices) {
    const seq = parseDeviceIdSeq(d.assetTag);
    if (seq && !claimed.has(seq)) {
      claimed.set(seq, d.id);
      assigned.set(d.id, seq);
    }
  }

  // Pass 2: everyone else gets the next unused number
  let cursor = 1;
  const nextUnused = (): number => {
    while (claimed.has(cursor)) cursor++;
    const n = cursor;
    claimed.set(n, "__pending__");
    cursor++;
    return n;
  };
  for (const d of devices) {
    if (assigned.has(d.id)) continue;
    const n = nextUnused();
    claimed.set(n, d.id);
    assigned.set(d.id, n);
  }

  // Build the mapping table + print it before writing.
  const mapping = devices.map((d) => ({
    id: d.id,
    old: d.assetTag ?? "(null)",
    new: formatDeviceId(assigned.get(d.id)!),
  }));

  console.log("\nold → new");
  console.log("=".repeat(60));
  for (const m of mapping) {
    console.log(`${m.old.padEnd(30)} → ${m.new}    ${m.id}`);
  }
  console.log("=".repeat(60));

  // Next unused sequence after everyone is placed. The counter's `nextSeq`
  // stores what the *next* device to be created should get, so it's max+1.
  const maxAssigned = Math.max(0, ...Array.from(assigned.values()));
  const nextSeqValue = maxAssigned + 1;
  console.log(`\ncounter.nextSeq will be set to ${nextSeqValue} (max assigned = ${maxAssigned})`);

  if (dryRun) {
    console.log("\n[dry-run] done — no writes performed");
    return;
  }

  console.log("\napplying in one transaction…");
  await prisma.$transaction(async (tx) => {
    // Two-phase rename to avoid transient @unique clashes if the constraint
    // is added later. Phase 1: park every device on a scratch value keyed by
    // its cuid (guaranteed unique). Phase 2: apply the final ROQIT_NNN.
    for (const d of devices) {
      await tx.device.update({
        where: { id: d.id },
        data: { assetTag: `__renumber_${d.id}` },
      });
    }
    for (const d of devices) {
      const seq = assigned.get(d.id)!;
      await tx.device.update({
        where: { id: d.id },
        data: { assetTag: formatDeviceId(seq) },
      });
    }
    // Reset/seed the counter.
    await tx.deviceIdCounter.upsert({
      where: { id: 1 },
      create: { id: 1, nextSeq: nextSeqValue },
      update: { nextSeq: nextSeqValue },
    });
  });
  console.log(`done — ${devices.length} device(s) renamed`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
