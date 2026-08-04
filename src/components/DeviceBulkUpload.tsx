"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUploadDevices, type BulkImportResult } from "@/app/actions";

// Collapsible panel on the Devices page: download the template, then upload a
// filled-in .xlsx. Results (created / skipped / per-row errors) show inline.
export function DeviceBulkUpload() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await bulkUploadDevices(fd);
      setResult(res);
      if (res.ok && res.created) {
        form.reset();
        setFileName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="card mb-4 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span>
          <span className="text-sm font-semibold text-fg">Bulk upload from Excel</span>
          <span className="ml-2 text-xs text-muted">Import many devices at once from the shared template</span>
        </span>
        <span className="text-muted">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <ol className="mb-4 space-y-1 text-sm text-muted">
            <li>
              1. <a href="/api/export/device-template" className="font-medium text-brand-600 hover:underline">Download the template</a> and fill one row per device.
            </li>
            <li>2. Save it as <code className="rounded bg-surface-2 px-1">.xlsx</code>, then choose it below and import.</li>
          </ol>

          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label className="label">Excel file (.xlsx)</label>
              <input
                className="input"
                type="file"
                name="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? "Importing…" : "Import devices"}
            </button>
          </form>

          {result?.error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{result.error}</p>
          )}

          {result?.ok && (
            <div className="mt-3 space-y-2">
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                Imported <strong>{result.created}</strong> device{result.created === 1 ? "" : "s"}
                {result.skipped ? `, skipped ${result.skipped} already-imported row${result.skipped === 1 ? "" : "s"}` : ""}
                {result.errors && result.errors.length ? `, ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} failed` : ""}.
              </p>
              {result.errors && result.errors.length > 0 && (
                <ul className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                  {result.errors.slice(0, 20).map((er) => (
                    <li key={er.row}>Row {er.row}: {er.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
