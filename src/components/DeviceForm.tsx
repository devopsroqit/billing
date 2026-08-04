"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDevice } from "@/app/actions";
import { DEVICE_STATUSES, DEVICE_STATUS_LABELS, CURRENCIES } from "@/lib/constants";

type Option = { id: string; label: string };
export type DeviceInitial = {
  id?: string;
  purchaseId?: string | null;
  supplierId?: string | null;
  assetTag?: string | null;
  deviceName?: string | null;
  modelNo?: string | null;
  serialImei?: string | null;
  qtyPurchased?: number;
  vendorName?: string | null;
  invoiceNo?: string | null;
  cost?: number; // major units
  currency?: string;
  purchaseDate?: string;
  assignedTo?: string | null;
  projectClient?: string | null;
  location?: string | null;
  statusText?: string | null;
  installedStatus?: string | null;
  installedBy?: string | null;
  status?: string;
  notes?: string | null;
};

export function DeviceForm({
  device,
  suppliers,
  purchases,
  defaultPurchaseId,
  defaultSupplierId,
}: {
  device?: DeviceInitial;
  suppliers: Option[];
  purchases: Option[];
  defaultPurchaseId?: string;
  defaultSupplierId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveDevice(fd);
      if (res?.error) setError(res.error);
      // success → server action redirects to /devices
    });
  }

  const v = device ?? {};

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Device ID</label>
          <input className="input" name="assetTag" defaultValue={v.assetTag ?? ""} placeholder="e.g. ROQIT-GPS-001" />
        </div>
        <div>
          <label className="label">Purchase date</label>
          <input className="input" type="date" name="purchaseDate" defaultValue={v.purchaseDate ?? ""} />
        </div>
        <div>
          <label className="label">Device name</label>
          <input className="input" name="deviceName" defaultValue={v.deviceName ?? ""} placeholder="e.g. Sinocastle dash cam" />
        </div>
        <div>
          <label className="label">Model no.</label>
          <input className="input" name="modelNo" defaultValue={v.modelNo ?? ""} placeholder="e.g. A-267 AI Dash cam" />
        </div>
        <div>
          <label className="label">Serial no. / IMEI</label>
          <input className="input" name="serialImei" defaultValue={v.serialImei ?? ""} />
        </div>
        <div>
          <label className="label">Qty purchased</label>
          <input className="input" type="number" min="1" name="qtyPurchased" defaultValue={v.qtyPurchased ?? 1} />
        </div>
        <div>
          <label className="label">Vendor name</label>
          <input className="input" name="vendorName" defaultValue={v.vendorName ?? ""} placeholder="e.g. Sinocastle" />
        </div>
        <div>
          <label className="label">Invoice no.</label>
          <input className="input" name="invoiceNo" defaultValue={v.invoiceNo ?? ""} />
        </div>
        <div>
          <label className="label">Purchase cost</label>
          <input className="input" type="number" step="0.01" min="0" name="cost" defaultValue={v.cost ?? ""} />
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input" name="currency" defaultValue={v.currency ?? "INR"}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Assigned to</label>
          <input className="input" name="assignedTo" defaultValue={v.assignedTo ?? ""} />
        </div>
        <div>
          <label className="label">Project / Client</label>
          <input className="input" name="projectClient" defaultValue={v.projectClient ?? ""} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" name="location" defaultValue={v.location ?? ""} placeholder="e.g. Hyderabad" />
        </div>
        <div>
          <label className="label">Status</label>
          <input className="input" name="statusText" defaultValue={v.statusText ?? ""} placeholder="e.g. ETO custody" />
        </div>
        <div>
          <label className="label">Installed status</label>
          <select className="input" name="installedStatus" defaultValue={v.installedStatus ?? ""}>
            <option value="">—</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className="label">Installed by</label>
          <input className="input" name="installedBy" defaultValue={v.installedBy ?? ""} />
        </div>
        <div>
          <label className="label">Inventory status</label>
          <select className="input" name="status" defaultValue={v.status ?? "IN_STOCK"}>
            {DEVICE_STATUSES.map((s) => <option key={s} value={s}>{DEVICE_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Supplier <span className="font-normal text-faint">(optional link)</span></label>
          <select className="input" name="supplierId" defaultValue={v.supplierId ?? defaultSupplierId ?? ""}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Purchase <span className="font-normal text-faint">(optional link)</span></label>
          <select className="input" name="purchaseId" defaultValue={v.purchaseId ?? defaultPurchaseId ?? ""}>
            <option value="">— None —</option>
            {purchases.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Remarks</label>
        <textarea className="input" name="notes" rows={2} defaultValue={v.notes ?? ""} />
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : v.id ? "Save changes" : "Add device"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.push("/devices")}>Cancel</button>
      </div>
    </form>
  );
}
