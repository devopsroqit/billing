"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// In-app toast + confirm-modal chrome. Mounted once at the (app) layout so any
// client component under it can call useToast() / useConfirm() instead of the
// native alert() / window.confirm() browser popups.

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmResolver = (ok: boolean) => void;

const ToastCtx = createContext<ToastApi | null>(null);
const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <AppChrome>");
  return ctx;
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <AppChrome>");
  return ctx;
}

export function AppChrome({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  const [confirmState, setConfirmState] = useState<
    { opts: ConfirmOptions; resolve: ConfirmResolver } | null
  >(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ opts, resolve });
      }),
    [],
  );

  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <ToastStack toasts={toasts} onDismiss={dismiss} />
        {confirmState && (
          <ConfirmModal
            opts={confirmState.opts}
            onCancel={() => closeConfirm(false)}
            onConfirm={() => closeConfirm(true)}
          />
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  // Alpha-tinted grounds + a semantic-colored icon so each kind reads on both
  // the light and the dark theme without a second style block.
  const tone: Record<ToastKind, string> = {
    success: "border-emerald-500/40 bg-emerald-500/10 text-fg",
    error: "border-red-500/40 bg-red-500/10 text-fg",
    info: "border-brand-500/40 bg-brand-500/10 text-fg",
  };
  const iconTone: Record<ToastKind, string> = {
    success: "bg-emerald-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-brand-600 text-white",
  };
  const icon: Record<ToastKind, string> = { success: "✓", error: "!", info: "i" };
  return (
    <div
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      role="region"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-end gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-4 py-3 shadow-lg backdrop-blur-sm ${tone[t.kind]}`}
        >
          <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${iconTone[t.kind]}`}>
            {icon[t.kind]}
          </span>
          <p className="min-w-0 flex-1 text-sm">{t.message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 text-lg leading-none opacity-60 hover:opacity-100"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({
  opts,
  onCancel,
  onConfirm,
}: {
  opts: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Escape closes, and keyboard focus is trapped inside the modal for its
  // lifetime. When the modal closes, focus returns to whatever launched it.
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusables = () => {
      if (!panelRef.current) return [] as HTMLElement[];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Tab") {
        const list = focusables();
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
    >
      <div className="modal-backdrop absolute inset-0 bg-black/40" onClick={onCancel} />
      <div ref={panelRef} className="modal-in relative w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h2 id="confirm-title" className="text-base font-semibold text-fg">
          {opts.title}
        </h2>
        {opts.body && <p className="mt-2 text-sm text-muted">{opts.body}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {opts.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            className={opts.danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            autoFocus
          >
            {opts.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
