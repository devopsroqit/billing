import { format } from "date-fns";
import type { ActivityAuditItem } from "@/components/crm/ActivityAuditFeed";
import type { NoteItem } from "@/components/crm/NotePanel";

type CommentRow = { id: string; authorId: string | null; body: string; parentId: string | null; createdAt: Date };
type ActivityRow = {
  id: string; action: string; entityType: string; summary: string;
  field: string | null; previousValue: string | null; newValue: string | null;
  actorId: string | null; createdAt: Date; comments: CommentRow[];
};
type NoteRow = { id: string; authorId: string | null; body: string; createdAt: Date };

const when = (d: Date) => format(d, "d MMM yyyy, HH:mm");
type NameOf = (id: string | null) => string | null;

// Maps an Activity audit row (+ its comments) to the feed's display item.
export function toAuditItem(a: ActivityRow, userName: NameOf): ActivityAuditItem {
  return {
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    summary: a.summary,
    field: a.field,
    previousValue: a.previousValue,
    newValue: a.newValue,
    actorName: userName(a.actorId),
    whenLabel: when(a.createdAt),
    comments: a.comments.map((c) => ({
      id: c.id,
      authorName: userName(c.authorId),
      body: c.body,
      whenLabel: when(c.createdAt),
      parentId: c.parentId,
    })),
  };
}

export function toNoteItem(n: NoteRow, userName: NameOf): NoteItem {
  return { id: n.id, authorName: userName(n.authorId), body: n.body, whenLabel: when(n.createdAt) };
}
