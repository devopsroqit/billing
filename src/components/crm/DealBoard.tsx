"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { formatMoney } from "@/lib/money";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from "@/lib/constants";
import { updateDealStage } from "@/app/crm-actions";
import { useToast } from "@/components/ui/AppChrome";

export type BoardDeal = {
  id: string;
  title: string;
  stage: string;
  company: string | null;
  owner: string | null;
  amountMinor: number;
  valueLabel: string; // pre-formatted, "" when zero
  nextTaskLabel: string | null;
  active: boolean;
  projectCompleted: boolean;
};

// A Kanban board of deals: one column per pipeline stage. Dragging a card into
// another column persists the new stage via updateDealStage (optimistic, with
// revert on failure). Read-only for viewers (no drag handles attached).
export function DealBoard({ deals, editable }: { deals: BoardDeal[]; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<BoardDeal[]>(deals);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-sync when the server sends a fresh list (search/filter change or refresh).
  useEffect(() => setItems(deals), [deals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const activeDeal = items.find((d) => d.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const newStage = e.over ? String(e.over.id) : null;
    if (!newStage || !(DEAL_STAGES as readonly string[]).includes(newStage)) return;

    const deal = items.find((d) => d.id === id);
    if (!deal || deal.stage === newStage) return;

    const prevStage = deal.stage;
    setItems((cur) => cur.map((d) => (d.id === id ? { ...d, stage: newStage } : d))); // optimistic
    const res = await updateDealStage(id, newStage);
    if (res && "error" in res && res.error) {
      setItems((cur) => cur.map((d) => (d.id === id ? { ...d, stage: prevStage } : d))); // revert
      toast.error(res.error);
      return;
    }
    toast.success(`Moved to ${DEAL_STAGE_LABELS[newStage as DealStage] ?? newStage}.`);
    router.refresh();
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((stage) => {
          const colDeals = items.filter((d) => d.stage === stage);
          const sumMinor = colDeals.reduce((s, d) => s + d.amountMinor, 0);
          return (
            <Column
              key={stage}
              stage={stage}
              label={DEAL_STAGE_LABELS[stage as DealStage]}
              count={colDeals.length}
              sumLabel={formatMoney(sumMinor, "INR")}
              editable={editable}
            >
              {colDeals.map((d) => (
                <Card key={d.id} deal={d} editable={editable} dragging={activeId === d.id} />
              ))}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>{activeDeal ? <CardBody deal={activeDeal} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  label,
  count,
  sumLabel,
  editable,
  children,
}: {
  stage: string;
  label: string;
  count: number;
  sumLabel: string;
  editable: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !editable });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted">{label}</span>
        <span className="num rounded border border-border px-1.5 py-0.5 text-[10px] text-faint">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[8rem] flex-1 flex-col gap-2 rounded-md border p-2 transition-colors ${
          isOver ? "border-brand-500 bg-brand-500/10" : "border-border bg-surface-2/40"
        }`}
      >
        {children}
        {count === 0 && (
          <p className="select-none px-1 py-8 text-center text-xs text-faint">{editable ? "Drop here" : "—"}</p>
        )}
      </div>
      <div className="num mt-2 flex items-center justify-between px-1 text-[11px] text-muted">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Sum</span>
        <span>{sumLabel}</span>
      </div>
    </div>
  );
}

function Card({ deal, editable, dragging }: { deal: BoardDeal; editable: boolean; dragging: boolean }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id: deal.id, disabled: !editable });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(editable ? { ...listeners, ...attributes } : {})}
      className={`${editable ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <CardBody deal={deal} />
    </div>
  );
}

// Card visual — shared by the in-column card and the drag overlay.
function CardBody({ deal, overlay }: { deal: BoardDeal; overlay?: boolean }) {
  return (
    <div
      className={`rounded-md border border-border bg-surface p-3 transition-colors hover:border-fg/20 ${
        overlay ? "rotate-1 cursor-grabbing shadow-lg" : ""
      }`}
    >
      <Link
        href={`/crm/deals/${deal.id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-sm font-medium leading-snug text-fg hover:underline"
      >
        {deal.title}
      </Link>
      {deal.company && <p className="mt-0.5 font-mono text-[10.5px] text-muted">{deal.company}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="num text-[12px] font-semibold text-fg">{deal.valueLabel || "—"}</span>
        <span className="truncate text-xs text-muted">{deal.owner ?? "—"}</span>
      </div>
      {deal.nextTaskLabel && <p className="mt-1 truncate text-[11px] text-faint">⏰ {deal.nextTaskLabel}</p>}
      {(!deal.active || deal.projectCompleted) && (
        <div className="mt-1 flex gap-2 text-[11px]">
          {!deal.active && <span className="text-faint">Inactive</span>}
          {deal.projectCompleted && <span className="text-emerald-600">Completed</span>}
        </div>
      )}
    </div>
  );
}
