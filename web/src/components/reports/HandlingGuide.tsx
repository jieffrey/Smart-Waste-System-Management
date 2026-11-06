import { CategorySwatch } from "@/components/ui/CategorySwatch";
import { HANDLING } from "@/lib/handling";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { ReportCategory } from "@/types/api";

// Practical handling for the report's (final) category, so the dispatcher can brief the crew.
export function HandlingGuide({ category }: { category: ReportCategory }) {
  const guide = HANDLING[category];
  return (
    <section className="border-t border-ink pt-4">
      <p className="label-micro text-gray-600">Handling</p>
      <p className="mt-2 flex items-center gap-2 text-body font-semibold text-ink">
        <CategorySwatch category={category} />
        {CATEGORY_LABELS[category]}
      </p>
      <p className="mt-1 text-small text-gray-700">{guide.what}</p>
      <ul className="mt-3 space-y-1 text-small text-ink">
        {guide.handle.map((step) => (
          <li key={step} className="flex gap-2">
            <span aria-hidden="true" className="font-mono text-gray-600">
              —
            </span>
            {step}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-small text-ink">
        <span className="font-semibold">Where it goes:</span> {guide.goesTo}
      </p>
    </section>
  );
}
