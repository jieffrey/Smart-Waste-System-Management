import { cn } from "@/lib/utils";

type Props = {
  title: string;
  kicker?: React.ReactNode; // small line above the title, e.g. the date or an ID
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

// Page title block: an optional kicker, the title in extra-bold Jakarta Sans with display tracking
// and a 2px ink rule underneath.
export function PageHeader({ title, kicker, description, actions, className }: Props) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4", className)}>
      <div className="min-w-0">
        {kicker && <div className="font-mono text-small text-gray-700">{kicker}</div>}
        <h1 className="tracking-display mt-1 text-title leading-tight font-extrabold text-ink">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-body text-gray-700">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
