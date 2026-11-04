import { CategorySwatch } from "./CategorySwatch";
import { CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ReportCategory } from "@/types/api";

// A square swatch in the category color + an ink label (red orange text would fail AA at this size).
export function CategoryLabel({ category, className }: { category: ReportCategory; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-small whitespace-nowrap text-ink", className)}>
      <CategorySwatch category={category} />
      {CATEGORY_LABELS[category]}
    </span>
  );
}
