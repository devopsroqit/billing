"use client";

import { useEffect, useState, useTransition } from "react";

type Kind = "text" | "email" | "tel" | "textarea" | "select";
type Opt = { value: string; label: string };

// A single field that shows its value (or a guiding placeholder) and turns into
// an input on click. Saves via the passed action on blur / Enter / select. When
// not editable it renders as plain, non-interactive text.
export function InlineField({
  value,
  placeholder = "Add…",
  kind = "text",
  options,
  editable = true,
  onSave,
  render,
}: {
  value: string;
  placeholder?: string;
  kind?: Kind;
  options?: Opt[];
  editable?: boolean;
  onSave: (value: string) => Promise<{ ok?: boolean; error?: string } | void>;
  render?: (value: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => setVal(value), [value]);

  function save(next: string) {
    setEditing(false);
    if (next === value) return;
    setErr("");
    start(async () => {
      const r = await onSave(next);
      if (r && "error" in r && r.error) {
        setErr(r.error);
        setVal(value);
      }
    });
  }

  if (!editable || !editing) {
    const empty = value === "" || value == null;
    return (
      <span className="inline-flex min-h-[1.5rem] items-center gap-2">
        <button
          type="button"
          disabled={!editable}
          onClick={() => editable && setEditing(true)}
          className={`text-left text-sm ${empty ? "text-faint" : "text-fg"} ${
            editable ? "rounded px-1 -mx-1 hover:bg-surface-2 hover:text-brand-600" : "cursor-default"
          }`}
          title={editable ? "Click to edit" : undefined}
        >
          {empty ? placeholder : render ? render(value) : value}
        </button>
        {pending && <span className="text-xs text-faint">saving…</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </span>
    );
  }

  if (kind === "select") {
    return (
      <select
        autoFocus
        className="input text-sm"
        value={val}
        onChange={(e) => save(e.target.value)}
        onBlur={() => setEditing(false)}
      >
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  if (kind === "textarea") {
    return (
      <textarea
        autoFocus
        rows={3}
        className="input text-sm"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => save(val)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setVal(value); setEditing(false); }
        }}
      />
    );
  }

  return (
    <input
      autoFocus
      type={kind}
      className="input text-sm"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => save(val)}
      onKeyDown={(e) => {
        if (e.key === "Enter") save(val);
        if (e.key === "Escape") { setVal(value); setEditing(false); }
      }}
    />
  );
}
