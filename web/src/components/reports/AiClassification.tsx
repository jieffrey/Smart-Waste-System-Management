import { CategoryLabel } from "@/components/ui/CategoryLabel";
import { formatPercent } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { AdminReportDetail } from "@/types/api";

type Props = Pick<AdminReportDetail, "category" | "ai_predicted_category" | "ai_confidence" | "ai_model_version">;

// The AI result in plain language: what it sorted the photo as, how sure it was, and whether an admin
// corrected it. The category routes the report, so it leads.
export function AiClassification({ category, ai_predicted_category, ai_confidence, ai_model_version }: Props) {
  const corrected = ai_predicted_category !== null && ai_predicted_category !== category;

  return (
    <section className="border-t border-ink pt-4">
      <p className="label-micro text-gray-600">AI sorting</p>
      {ai_predicted_category === null ? (
        <p className="mt-2 text-body text-ink">
          The AI has no result for this report. It is routed as <CategoryLabel category={category} className="align-middle" />.
        </p>
      ) : (
        <>
          <p className="mt-2 text-body text-ink">
            The AI sorted this photo as <strong>{CATEGORY_LABELS[ai_predicted_category]}</strong>
            {ai_confidence !== null && (
              <>
                {" "}
                with <span className="font-mono">{formatPercent(ai_confidence)}</span> confidence
              </>
            )}
            .
          </p>
          {corrected ? (
            <p className="mt-2 text-body text-ink">
              <span className="highlight font-semibold">
                AI predicted {CATEGORY_LABELS[ai_predicted_category]}, corrected to {CATEGORY_LABELS[category]}
              </span>{" "}
              by an admin.
            </p>
          ) : (
            <p className="mt-2 text-small text-gray-700">No correction: it is routed as the AI said.</p>
          )}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-small">
            <div className="flex items-center gap-2">
              <dt className="label-micro text-gray-600">Routed as</dt>
              <dd>
                <CategoryLabel category={category} />
              </dd>
            </div>
            {ai_model_version && (
              <div className="flex items-center gap-2">
                <dt className="label-micro text-gray-600">Model</dt>
                <dd className="font-mono text-micro text-gray-700">{ai_model_version}</dd>
              </div>
            )}
          </dl>
        </>
      )}
    </section>
  );
}
