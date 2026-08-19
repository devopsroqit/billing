"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { linkDevicesToPurchase } from "@/app/actions";

export type DeviceRow = {
  id: string;
  dateLabel: string;
  assetTag: string | null;
  deviceName: string;
  modelNo: string;
  serialImei: string;
  qty: number;
  vendor: string;
  invoiceNo: string;
  costLabel: string;
  assignedTo: string;
  projectClient: string;
  location: string;
  statusText: string | null; // free-text custody status, if any
  status: string; // enum, for the badge fallback
  statusLabel: string;
  installedStatus: string;
  installedBy: string;
  notes: string;
};

type Option = { id: string; label: string };

// The Devices inventory table. When `editable`, rows carry checkboxes and a bulk
// action bar appears so several existing devices can be linked to a purchase at
// once (mirrors "add device" from the purchase side, in reverse).
export function DevicesTable({
  rows,
  purchases,
  editable,
}: {
  rows: DeviceRow[];
  purchases: Option[];
  editable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purchaseId, setPurchaseId] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allChecked = selected.size > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(allIds)));
  }
  function clear() {
    setSelected(new Set());
    setMsg(null);
  }

  function onLink() {
    setMsg(null);
    const ids = [...selected];
    start(async () => {
      const res = await linkDevicesToPurchase(purchaseId, ids);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      const label = purchases.find((p) => p.id === purchaseId)?.label ?? "the purchase";
      setMsg({ ok: true, text: `Linked ${res.linked ?? ids.length} device${(res.linked ?? ids.length) === 1 ? "" : "s"} to ${label}.` });
      setSelected(new Set());
      setPurchaseId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {editable && selected.size > 0 && (
        <div className="card flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-medium text-fg">{selected.size} selected</span>
          <select
            className="input h-9 w-auto min-w-[16rem] py-0"
            value={purchaseId}
            onChange={(e) => setPurchaseId(e.target.value)}
          >
            <option value="">Choose a purchase…</option>
            {purchases.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={onLink} disabled={pending || !purchaseId}>
            {pending ? "Linking…" : "Link to purchase"}
          </button>
          <button className="btn-secondary" onClick={clear} disabled={pending}>Clear</button>
        </div>
      )}

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
          {msg.text}
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-2">
            <tr>
              {editable && (
                <th className="th w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allChecked; }}
                    onChange={toggleAll}
                    aria-label="Select all devices"
                  />
                </th>
              )}
              <th className="th">S.No</th>
              <th className="th">Date</th>
              <th className="th">Device ID</th>
              <th className="th">Device Name</th>
              <th className="th">Model No</th>
              <th className="th">Serial No / IMEI</th>
              <th className="th text-right">Qty</th>
              <th className="th">Vendor Name</th>
              <th className="th">Invoice No</th>
              <th className="th text-right">Purchase Cost</th>
              <th className="th">Assigned To</th>
              <th className="th">Project / Client</th>
              <th className="th">Location</th>
              <th className="th">Status</th>
              <th className="th">Installed</th>
              <th className="th">Installed by</th>
              <th className="th">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((d, i) => {
              const checked = selected.has(d.id);
              return (
                <tr key={d.id} className={checked ? "bg-brand-500/5" : "hover:bg-surface-2"}>
                  {editable && (
                    <td className="td">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={checked}
                        onChange={() => toggle(d.id)}
                        aria-label={`Select ${d.assetTag || d.deviceName || "device"}`}
                      />
                    </td>
                  )}
                  <td className="td text-faint">{i + 1}</td>
                  <td className="td whitespace-nowrap">{d.dateLabel}</td>
                  <td className="td">
                    <Link href={`/devices/${d.id}`} className="font-medium text-brand-600 hover:underline">
                      {d.assetTag || "—"}
                    </Link>
                  </td>
                  <td className="td font-medium text-fg">{d.deviceName}</td>
                  <td className="td">{d.modelNo}</td>
                  <td className="td">{d.serialImei}</td>
                  <td className="td text-right">{d.qty}</td>
                  <td className="td">{d.vendor}</td>
                  <td className="td">{d.invoiceNo}</td>
                  <td className="td whitespace-nowrap text-right">{d.costLabel}</td>
                  <td className="td">{d.assignedTo}</td>
                  <td className="td">{d.projectClient}</td>
                  <td className="td">{d.location}</td>
                  <td className="td">
                    {d.statusText ? <span>{d.statusText}</span> : <StatusBadge status={d.status} label={d.statusLabel} />}
                  </td>
                  <td className="td">{d.installedStatus}</td>
                  <td className="td">{d.installedBy}</td>
                  <td className="td max-w-[16rem]"><span className="line-clamp-2 text-xs text-muted">{d.notes}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
