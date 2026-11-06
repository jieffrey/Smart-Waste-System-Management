import { cn } from "@/lib/utils";

// "Nothing here" message: a rule above, a short headline and an optional hint. No box, no illustration.
// size="page" is for when the whole page is the empty state (e.g. a report that doesn't exist).
export function EmptyState({
  title,
  hint,
  size = "section",
  children,
}: {
  title: string;
  hint?: string;
  size?: "section" | "page";
  children?: React.ReactNode;
}) {
  const page = size === "page";
  return (
    <div className={cn("border-t border-ink", page ? "py-16" : "py-12")}>
      <p className={cn("font-semibold text-ink", page ? "font-semiwide text-title tracking-tight" : "text-heading")}>{title}</p>
      {hint && <p className={cn("mt-1 text-gray-600", page ? "text-body" : "text-small")}>{hint}</p>}
      {children && <div className={page ? "mt-6" : "mt-4"}>{children}</div>}
    </div>
  );
}
