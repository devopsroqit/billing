import { redirect } from "next/navigation";

// Suppliers & Purchases were merged into the Procurement page (two sub-tabs).
// Keep this route as a redirect so bookmarks and back-links still work.
export default function PurchasesPage() {
  redirect("/procurement?tab=purchases");
}
