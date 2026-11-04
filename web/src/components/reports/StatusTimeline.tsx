import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/labels";
import type { StatusHistoryEntry } from "@/types/api";
import { StatusBadge } from "./StatusBadge";

// Status changes, newest first: old -> new, who changed it, when, and the note.
export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  const newestFirst = [...history].reverse(); // the backend returns them oldest first

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium">Status history</h2>
      {newestFirst.length === 0 ? (
        <p className="mt-2 text-small text-zinc-500">No status changes yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {newestFirst.map((entry, index) => (
            <li key={`${entry.created_at}-${index}`} className="border-l-2 border-zinc-200 pl-3 text-small">
              <div className="flex flex-wrap items-center gap-2">
                {entry.old_status === null ? (
                  <span className="text-zinc-600">Reported as</span>
                ) : (
                  <>
                    <span className="text-zinc-600">{STATUS_LABELS[entry.old_status]}</span>
                    <span aria-hidden="true" className="text-zinc-400">
                      →
                    </span>
                    <span className="sr-only">changed to</span>
                  </>
                )}
                <StatusBadge status={entry.new_status} />
              </div>
              <p className="mt-1 text-zinc-500">
                {entry.changed_by_name} · {formatDateTime(entry.created_at)} WIB
              </p>
              {entry.note && <p className="mt-1 whitespace-pre-wrap text-zinc-800">“{entry.note}”</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
