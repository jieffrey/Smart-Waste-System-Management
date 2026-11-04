import { formatPercent } from "@/lib/format";
import type { Stats } from "@/types/api";

export function AiAccuracyCard({ aiAccuracy }: { aiAccuracy: Stats["ai_accuracy"] }) {
  const { reviewed, matching, accuracy } = aiAccuracy;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium">AI accuracy</h2>
      {accuracy === null ? (
        <p className="mt-3 text-sm text-zinc-500">No reviewed reports yet</p>
      ) : (
        <div className="mt-3">
          <p className="text-2xl font-semibold">{formatPercent(accuracy)}</p>
          <p className="text-sm text-zinc-600">
            {matching} / {reviewed} reviewed reports kept the AI&apos;s category
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        &quot;Reviewed&quot; means an admin moved the report to In progress or Completed and it has an AI prediction; it
        counts as a match when the final category still equals the AI&apos;s prediction. Pending and rejected reports
        are not counted.
      </p>
    </section>
  );
}
