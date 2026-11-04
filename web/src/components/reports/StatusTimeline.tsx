import { StatusMarker } from "@/components/ui/StatusMarker";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/labels";
import type { StatusHistoryEntry } from "@/types/api";

// Status changes as a sequence, newest first: when (mono), the new status, where it came from, who
// changed it and the note. A vertical ink rule connects the steps.
export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  const newestFirst = [...history].reverse(); // the backend returns them oldest first

  return (
    <section className="border-t border-ink pt-4">
      <p className="label-micro text-gray-600">History</p>
      <h2 className="mt-1 text-heading font-semibold text-ink">Status timeline</h2>
      {newestFirst.length === 0 ? (
        <p className="mt-3 text-small text-gray-600">No status changes yet.</p>
      ) : (
        <ol className="mt-4 border-l-2 border-ink">
          {newestFirst.map((entry, index) => (
            <li
              key={`${entry.created_at}-${index}`}
              className="grid gap-x-6 gap-y-1 border-b border-gray-200 py-3 pl-4 last:border-b-0 sm:grid-cols-[11rem_1fr]"
            >
              <p className="font-mono text-small text-gray-700">{formatDateTime(entry.created_at)} WIB</p>
              <div>
                <p className="flex flex-wrap items-center gap-x-2 text-small text-ink">
                  <StatusMarker status={entry.new_status} className="font-semibold" />
                  <span className="text-gray-600">
                    {entry.old_status === null ? "· reported" : `· from ${STATUS_LABELS[entry.old_status]}`} by{" "}
                    {entry.changed_by_name}
                  </span>
                </p>
                {entry.note && <p className="mt-1 text-small whitespace-pre-wrap text-ink">“{entry.note}”</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
