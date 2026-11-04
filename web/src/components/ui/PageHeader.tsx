import { cn } from "@/lib/utils";

type Props = {
  title: string;
  kicker?: string; // small mono line above the title, e.g. "Reports · 173 total"
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

// Page title block: a mono kicker, a semi-wide title and a 2px ink rule underneath.
export function PageHeader({ title, kicker, description, actions, className }: Props) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4", className)}>
      <div className="min-w-0">
        {kicker && <p className="label-micro text-gray-600">{kicker}</p>}
        <h1 className="font-semiwide mt-1 text-title font-bold tracking-tight text-ink">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-body text-gray-700">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
