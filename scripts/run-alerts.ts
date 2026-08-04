// Standalone alert runner — wire this to cron / a scheduled job.
//   npm run alerts:run
// It marks overdue invoices, queues due-soon + overdue reminder emails, then
// "sends" everything in the outbox (simulated).
import { runAlerts } from "../src/lib/alerts";
import { flushOutbox } from "../src/lib/email";

async function main() {
  const alerts = await runAlerts();
  const flush = await flushOutbox();
  console.log("Alert run complete:");
  console.log(`  marked overdue : ${alerts.markedOverdue}`);
  console.log(`  due-soon queued: ${alerts.dueSoonQueued}`);
  console.log(`  overdue queued : ${alerts.overdueQueued}`);
  console.log(`  emails sent    : ${flush.sent} (failed: ${flush.failed})`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
