import { CATEGORY_LABELS, REPORT_CATEGORIES } from "@/lib/labels";
import type { Stats } from "@/types/api";

// Reports per category (the category an admin confirmed or changed, not only the AI's guess).
export function CategoryCounts({ byCategory }: { byCategory: Stats["totals"]["by_category"] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium">Reports by category</h2>
      <ul className="mt-3 divide-y divide-zinc-100 text-small">
        {REPORT_CATEGORIES.map((category) => (
          <li key={category} className="flex justify-between py-2">
            <span>{CATEGORY_LABELS[category]}</span>
            <span className="font-medium">{byCategory[category] ?? 0}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
