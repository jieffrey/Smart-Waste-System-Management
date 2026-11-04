import { cn } from "@/lib/utils";

// A dashboard region: a 1px ink rule, a mono kicker, a heading and an optional one-line takeaway.
// No box around it; regions differ in width by importance.
export function DashSection({
  kicker,
  title,
  takeaway,
  className,
  children,
}: {
  kicker: string;
  title: string;
  takeaway?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 border-t border-ink pt-4", className)}>
      <p className="label-micro text-gray-600">{kicker}</p>
      <h2 className="mt-1 text-heading font-semibold text-ink">{title}</h2>
      {takeaway && <p className="mt-1 text-small text-gray-700">{takeaway}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
