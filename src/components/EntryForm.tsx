"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEntry } from "@/app/actions";
import {
  VENDOR_TYPES,
  VENDOR_TYPE_LABELS,
  BILLING_FREQUENCIES,
  BILLING_FREQUENCY_LABELS,
  ENTRY_STATUSES,
  ENTRY_STATUS_LABELS,
} from "@/lib/constants";

export type ServiceOption = {
  id: string;
  name: string;
  vendorType: string;
  billingFrequency: string;
  dueDayOfMonth: number | null;
  defaultInr: number;
  defaultUsd: number;
  defaultEur: number;
};

export type EntryInitial = {
  id?: string;
  serviceId?: string | null;
  serviceName: string;
  vendorType: string;
  billingFrequency: string;
  status: string;
  dueDate?: string;
  paymentMadeOn?: string;
  amountInr: number;
  amountUsd: number;
  amountEur: number;
  thisMonthPaidInr: number;
  notes?: string;
};

const money = (n: number) => (n ? (n / 100).toString() : "");

export function EntryForm({
  year,
  month,
  services,
  initial,
}: {
  year: number;
  month: number;
  services: ServiceOption[];
  initial?: EntryInitial;
}) {
  const router = useRouter();
  const [f, setF] = useState<EntryInitial>(
    initial ?? {
      serviceId: "",
      serviceName: "",
      vendorType: "SUBSCRIPTION",
      billingFrequency: "MONTHLY",
      status: "PENDING",
      amountInr: 0,
      amountUsd: 0,
      amountEur: 0,
      thisMonthPaidInr: 0,
    },
  );
  const [inrStr, setInrStr] = useState(money(f.amountInr));
  const [usdStr, setUsdStr] = useState(money(f.amountUsd));
  const [eurStr, setEurStr] = useState(money(f.amountEur));
  const [paidStr, setPaidStr] = useState(money(f.thisMonthPaidInr));

  function onServiceChange(id: string) {
    const svc = services.find((s) => s.id === id);
    if (!svc) {
      setF({ ...f, serviceId: "" });
      return;
    }
    const dueDate =
      svc.dueDayOfMonth != null
        ? new Date(year, month - 1, Math.min(svc.dueDayOfMonth, new Date(year, month, 0).getDate()))
            .toISOString()
            .slice(0, 10)
        : "";
    setF({
      ...f,
      serviceId: svc.id,
      serviceName: svc.name,
      vendorType: svc.vendorType,
      billingFrequency: svc.billingFrequency,
      dueDate: dueDate || f.dueDate,
    });
    setInrStr(money(svc.defaultInr));
    setUsdStr(money(svc.defaultUsd));
    setEurStr(money(svc.defaultEur));
  }

  return (
    <form action={saveEntry} className="card space-y-5 p-6">
      {f.id && <input type="hidden" name="id" value={f.id} />}
      <input type="hidden" name="periodYear" value={year} />
      <input type="hidden" name="periodMonth" value={month} />
      <input type="hidden" name="serviceId" value={f.serviceId ?? ""} />

      {services.length > 0 && (
        <div>
          <label className="label">Pick a service (fills the fields below)</label>
          <select className="input" value={f.serviceId ?? ""} onChange={(e) => onServiceChange(e.target.value)}>
            <option value="">— One-off / manual entry —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Service name</label>
          <input className="input" name="serviceName" value={f.serviceName} onChange={(e) => setF({ ...f, serviceName: e.target.value })} required />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {ENTRY_STATUSES.map((s) => (
              <option key={s} value={s}>{ENTRY_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="vendorType" value={f.vendorType} onChange={(e) => setF({ ...f, vendorType: e.target.value })}>
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Billing frequency</label>
          <select className="input" name="billingFrequency" value={f.billingFrequency} onChange={(e) => setF({ ...f, billingFrequency: e.target.value })}>
            {BILLING_FREQUENCIES.map((b) => (
              <option key={b} value={b}>{BILLING_FREQUENCY_LABELS[b]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due date</label>
          <input className="input" type="date" name="dueDate" value={f.dueDate ?? ""} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Payment made on</label>
          <input className="input" type="date" name="paymentMadeOn" value={f.paymentMadeOn ?? ""} onChange={(e) => setF({ ...f, paymentMadeOn: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label">Amount (INR)</label>
          <input className="input" name="amountInr" type="number" step="0.01" min="0" value={inrStr} onChange={(e) => setInrStr(e.target.value)} />
        </div>
        <div>
          <label className="label">Amount (USD)</label>
          <input className="input" name="amountUsd" type="number" step="0.01" min="0" value={usdStr} onChange={(e) => setUsdStr(e.target.value)} />
        </div>
        <div>
          <label className="label">Amount (EUR)</label>
          <input className="input" name="amountEur" type="number" step="0.01" min="0" value={eurStr} onChange={(e) => setEurStr(e.target.value)} />
        </div>
        <div>
          <label className="label">This month paid (INR)</label>
          <input className="input" name="thisMonthPaidInr" type="number" step="0.01" min="0" value={paidStr} onChange={(e) => setPaidStr(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" name="notes" rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{f.id ? "Save changes" : "Add row"}</button>
        <button className="btn-secondary" type="button" onClick={() => router.push(`/tracker?y=${year}&m=${month}`)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
