"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDealPayment, deleteDealPayment } from "@/app/crm-actions";
import { formatMoney } from "@/lib/money";
import { PAYMENT_MILESTONES, PAYMENT_MILESTONE_LABELS, type Currency } from "@/lib/constants";
import { useConfirm, useToast } from "@/components/ui/AppChrome";

export type PaymentItem = {
  id: string;
  amountMinor: number;
  amountLabel: string;
  milestone: string;
  milestoneLabel: string;
  reference: string | null;
  authorName: string | null;
  whenLabel: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function DealPaymentPanel({
  payments,
  anchor,
  agreedMinor,
  currency,
  editable,
}: {
  payments: PaymentItem[];
  anchor: { dealId: string };
  agreedMinor: number;
  currency: Currency;
  editable: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [milestone, setMilestone] = useState<string>("ADVANCE");
  const [receivedAt, setReceivedAt] = useState(today());
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const received = payments.reduce((sum, p) => sum + p.amountMinor, 0);
  const balance = agreedMinor - received;

  function add() {
    setError("");
    start(async () => {
      const r = await saveDealPayment({ dealId: anchor.dealId, amount, milestone, receivedAt, reference });
      if (r && "error" in r && r.error) {
        setError(r.error);
      } else {
        setAmount("");
        setReference("");
        toast.success("Payment recorded.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Agreed / Received / Balance summary */}
      <div className="card grid grid-cols-3 divide-x divide-border">
        <Cell label="Agreed" value={formatMoney(agreedMinor, currency)} />
        <Cell label="Received" value={formatMoney(received, currency)} tone="text-emerald-600" />
        <Cell label="Balance" value={formatMoney(Math.max(balance, 0), currency)} tone={balance > 0 ? "text-amber-600" : "text-emerald-600"} />
      </div>

      {editable && (
        <div className="card space-y-3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Amount received ({currency})</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Milestone</label>
              <select className="input" value={milestone} onChange={(e) => setMilestone(e.target.value)}>
                {PAYMENT_MILESTONES.map((m) => (
                  <option key={m} value={m}>{PAYMENT_MILESTONE_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date received</label>
              <input className="input" type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            </div>
            <div>
              <label className="label">Reference <span className="font-normal text-faint">(optional)</span></label>
              <input className="input" placeholder="e.g. UTR / invoice no." value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={add} disabled={pending || !amount || Number(amount) <= 0}>
              {pending ? "Saving…" : "Add payment"}
            </button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="card p-4 text-sm text-muted">No payments recorded yet.</p>
      ) : (
        <div className="card divide-y divide-border">
          {payments.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">{p.amountLabel}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{p.milestoneLabel}</span>
                  <span>{p.whenLabel}</span>
                  {p.reference && <span>· {p.reference}</span>}
                  <span>· {p.authorName ?? "—"}</span>
                </div>
              </div>
              {editable && (
                <button
                  className="shrink-0 text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    const ok = await confirm({ title: "Delete this payment?", body: "This can't be undone.", confirmLabel: "Delete", danger: true });
                    if (!ok) return;
                    await deleteDealPayment(p.id);
                    toast.success("Payment deleted.");
                    router.refresh();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, tone = "text-fg" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-faint">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
