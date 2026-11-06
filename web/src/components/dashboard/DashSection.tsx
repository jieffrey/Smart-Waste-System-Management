import { cn } from "@/lib/utils";

// A white dashboard region. Two weights, so sections don't all share one template:
// - strong: 2px ink rule (the trend chart, second only to the color blocks)
// - quiet:  1px rule
// Every section title shares one size, so no chart title outranks the "Needs action" headline.
// The eyebrow (kicker) and the one-line takeaway are optional; use them only when they add information.
export function DashSection({
  kicker,
  title,
  takeaway,
  weight = "quiet",
  className,
  children,
}: {
  kicker?: string;
  title: string;
  takeaway?: React.ReactNode;
  weight?: "strong" | "quiet";
  className?: string;
  children: React.ReactNode;
}) {
  const strong = weight === "strong";
  return (
    <section className={cn("min-w-0 pt-4", strong ? "border-t-2 border-ink" : "border-t border-ink", className)}>
      {kicker && <p className="label-micro text-gray-600">{kicker}</p>}
      <h2 className={cn("text-heading font-semibold text-ink", kicker && "mt-1")}>
        {title}
      </h2>
      {takeaway && <p className="mt-1 text-small text-gray-700">{takeaway}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
