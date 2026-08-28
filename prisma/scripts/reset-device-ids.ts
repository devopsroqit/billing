/**
 * One-off cleanup: delete every device and reset the ID counter, so the
 * very next device you create gets ROQIT_001.
 *
 * Intended for the "we test-drove auto-assign, now start fresh for real
 * inventory" moment. This is the one time we intentionally break the
 * "never reused" invariant — because the rows being wiped are test rows,
 * not real assets. From here on the invariant holds again for every real
 * device.
 *
 * Usage:
 *   npx tsx prisma/scripts/reset-device-ids.ts --dry-run   # preview, no writes
 *   npx tsx prisma/scripts/reset-device-ids.ts             # apply
 *   npx tsx prisma/scripts/reset-device-ids.ts --force     # apply, ignore the
 *                                                         # "unexpected assetTag"
 *                                                         # guard
 *
 * Safety guard: refuses to run if any assetTag doesn't match ^ROQIT_\d+$
 * unless --force is passed. That protects against running this against a
 * DB that unexpectedly still has old ROQIT-GPS-* rows or real production
 * inventory — either would silently disappear otherwise.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OK_TAG = /^ROQIT_\d+$/;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  const devices = await prisma.device.findMany({
    select: { id: true, assetTag: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const counter = await prisma.deviceIdCounter.findUnique({ where: { id: 1 } });

  console.log(`\ncurrent state`);
  console.log("=".repeat(60));
  console.log(`devices in table: ${devices.length}`);
  for (const d of devices) {
    const tag = d.assetTag ?? "(null)";
    const flag = OK_TAG.test(tag) ? "" : "  ← UNEXPECTED format";
    console.log(`  ${tag}${flag}`);
  }
  console.log(`counter.nextSeq: ${counter?.nextSeq ?? "(not set)"}`);
  console.log("=".repeat(60));

  const suspect = devices.filter((d) => !d.assetTag || !OK_TAG.test(d.assetTag));
  if (suspect.length > 0 && !force) {
    console.error(
      `\n✗ Refusing to run — ${suspect.length} row(s) have an assetTag that doesn't ` +
        `look like a test row (^ROQIT_\\d+$). If you're sure you want to wipe them ` +
        `anyway, re-run with --force.`,
    );
    process.exit(2);
  }

  console.log(`\nafter reset`);
  console.log("=".repeat(60));
  console.log(`devices in table: 0`);
  console.log(`counter.nextSeq: 1`);
  console.log(`=> next created device will be ROQIT_001`);
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\n[dry-run] done — no writes performed");
    return;
  }

  console.log("\napplying in one transaction…");
  const result = await prisma.$transaction(async (tx) => {
    const del = await tx.device.deleteMany({});
    await tx.deviceIdCounter.upsert({
      where: { id: 1 },
      create: { id: 1, nextSeq: 1 },
      update: { nextSeq: 1 },
    });
    return del;
  });
  console.log(`done — deleted ${result.count} device(s), counter reset to 1`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
