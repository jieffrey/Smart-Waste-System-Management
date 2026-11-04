import { CATEGORY_COLORS } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { ReportCategory } from "@/types/api";

// A square in the true category color. `framed` adds a thin white border: use it on colored backgrounds, where
// a category can match the background (plastic = cobalt on the cobalt block, paper = ink on ink panels).
export function CategorySwatch({ category, framed = false, className }: { category: ReportCategory; framed?: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-block size-3 shrink-0", CATEGORY_COLORS[category].swatchClass, framed && "border border-white", className)}
      aria-hidden="true"
    />
  );
}
