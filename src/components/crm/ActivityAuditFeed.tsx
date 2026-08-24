"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ACTIVITY_ACTION_ICONS, type ActivityAction } from "@/lib/constants";
import { addActivityComment, deleteActivityComment } from "@/app/crm-actions";
import { useConfirm } from "@/components/ui/AppChrome";

export type CommentItem = {
  id: string;
  authorName: string | null;
  body: string;
  whenLabel: string;
  parentId: string | null;
};

export type ActivityAuditItem = {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  actorName: string | null;
  whenLabel: string;
  comments: CommentItem[];
};

// Renders a comment body with @mentions highlighted.
function withMentions(body: string) {
  return body.split(/(@[\w.+-]+(?:@[\w.-]+)?)/g).map((part, i) =>
    part.startsWith("@") ? <span key={i} className="font-medium text-brand-600">{part}</span> : <span key={i}>{part}</span>,
  );
}

export function ActivityAuditFeed({ items, editable }: { items: ActivityAuditItem[]; editable: boolean }) {
  if (items.length === 0) {
    return <p className="card p-4 text-sm text-muted">No activity yet. Changes to this record will appear here.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <ActivityRow key={a.id} activity={a} editable={editable} />
      ))}
    </div>
  );
}

function ActivityRow({ activity, editable }: { activity: ActivityAuditItem; editable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();

  const icon = ACTIVITY_ACTION_ICONS[activity.action as ActivityAction] ?? "folder";
  const roots = activity.comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => activity.comments.filter((c) => c.parentId === id);

  function submit() {
    const text = reply.trim();
    if (!text) return;
    start(async () => {
      const r = await addActivityComment({ activityId: activity.id, body: text });
      if (!r || !("error" in r) || !r.error) {
        setReply("");
        router.refresh();
      }
    });
  }

  return (
    <div className="card p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon name={icon} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">{activity.summary}</p>
          {(activity.previousValue || activity.newValue) && activity.action !== "CREATED" && (
            <p className="mt-0.5 text-xs text-faint">
              {activity.previousValue ? <span className="line-through">{activity.previousValue}</span> : null}
              {activity.previousValue && activity.newValue ? " → " : null}
              {activity.newValue ? <span className="text-muted">{activity.newValue}</span> : null}
            </p>
          )}
          <p className="mt-0.5 text-xs text-faint">{activity.actorName ?? "System"} · {activity.whenLabel}</p>

          {activity.comments.length > 0 && (
            <div className="mt-2 space-y-2 border-l border-border pl-3">
              {roots.map((c) => (
                <div key={c.id}>
                  <Comment c={c} editable={editable} onDelete={() => deleteActivityComment(c.id).then(() => router.refresh())} />
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="ml-4 mt-1">
                      <Comment c={r} editable={editable} onDelete={() => deleteActivityComment(r.id).then(() => router.refresh())} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {editable && (
            <div className="mt-2">
              {open ? (
                <div className="space-y-2">
                  <textarea
                    className="input text-sm"
                    rows={2}
                    placeholder="Add a comment… use @name to mention"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" onClick={submit} disabled={pending || !reply.trim()}>{pending ? "Posting…" : "Comment"}</button>
                    <button className="btn-secondary text-xs" onClick={() => { setOpen(false); setReply(""); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="text-xs font-medium text-muted hover:text-brand-600" onClick={() => setOpen(true)}>＋ Comment</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Comment({ c, editable, onDelete }: { c: CommentItem; editable: boolean; onDelete: () => void }) {
  const confirm = useConfirm();
  return (
    <div className="text-sm">
      <p className="whitespace-pre-wrap text-fg">{withMentions(c.body)}</p>
      <div className="flex items-center gap-2 text-xs text-faint">
        <span>{c.authorName ?? "—"} · {c.whenLabel}</span>
        {editable && (
          <button
            className="text-red-600 hover:underline"
            onClick={async () => {
              const ok = await confirm({ title: "Delete this comment?", body: "This can't be undone.", confirmLabel: "Delete", danger: true });
              if (ok) onDelete();
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
