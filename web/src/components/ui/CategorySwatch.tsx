import { CATEGORY_COLORS } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { ReportCategory } from "@/types/api";

// A square in the true category color. `framed` puts it in a white frame with a 2px snow gap: use it on colored
// backgrounds, where a category can match the background (plastic = cobalt on the cobalt block, paper = ink on
// ink panels). A border alone made those read as empty outlines; with the gap the fill always reads as solid.
export function CategorySwatch({ category, framed = false, className }: { category: ReportCategory; framed?: boolean; className?: string }) {
  if (framed) {
    return (
      <span className={cn("inline-flex size-3.5 shrink-0 border border-white bg-snow p-[2px]", className)} aria-hidden="true">
        <span className={cn("size-full", CATEGORY_COLORS[category].swatchClass)} />
      </span>
    );
  }
  return <span className={cn("inline-block size-3 shrink-0", CATEGORY_COLORS[category].swatchClass, className)} aria-hidden="true" />;
}
