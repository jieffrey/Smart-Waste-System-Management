import { formatPercent } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { AdminReportDetail } from "@/types/api";

type Props = Pick<AdminReportDetail, "category" | "ai_predicted_category" | "ai_confidence" | "ai_model_version">;

// What the AI predicted, and whether an admin corrected the category afterwards.
export function AiClassification({ category, ai_predicted_category, ai_confidence, ai_model_version }: Props) {
  const corrected = ai_predicted_category !== null && ai_predicted_category !== category;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium">Classification</h2>

      {ai_predicted_category === null ? (
        <p className="mt-2 text-sm text-zinc-500">No AI prediction for this report.</p>
      ) : (
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">AI prediction</dt>
          <dd>
            {CATEGORY_LABELS[ai_predicted_category]}
            {ai_confidence !== null && <span className="text-zinc-500"> · {formatPercent(ai_confidence)} confidence</span>}
          </dd>
          <dt className="text-zinc-500">Current category</dt>
          <dd className="font-medium">{CATEGORY_LABELS[category]}</dd>
          {ai_model_version && (
            <>
              <dt className="text-zinc-500">Model</dt>
              <dd className="text-zinc-500">{ai_model_version}</dd>
            </>
          )}
        </dl>
      )}

      {corrected && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          AI predicted <strong>{CATEGORY_LABELS[ai_predicted_category]}</strong>, corrected to{" "}
          <strong>{CATEGORY_LABELS[category]}</strong> by an admin.
        </p>
      )}
    </section>
  );
}
