"use client";

import { useState, useTransition } from "react";

// A button that invokes a server action and shows the returned message.
export function RunButton({
  action,
  label,
  className = "btn-primary",
}: {
  action: () => Promise<{ message: string }>;
  label: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>("");

  function onClick() {
    setMsg("");
    startTransition(async () => {
      try {
        const result = await action();
        setMsg(result?.message ?? "Done.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button className={className} onClick={onClick} disabled={pending}>
        {pending ? "Working…" : label}
      </button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
