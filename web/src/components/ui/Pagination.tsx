import Link from "next/link";
import { buttonVariants } from "./button";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  noun: { one: string; many: string }; // e.g. { one: "report", many: "reports" }
  hrefForPage: (page: number) => string;
};

// "Page 2 / 9 · 173 reports" in mono, with Previous/Next as secondary buttons.
// A server component, so hrefForPage can be a function.
export function Pagination({ page, totalPages, total, noun, hrefForPage }: Props) {
  const button = buttonVariants({ variant: "secondary", size: "sm" });
  const disabled = `${button} pointer-events-none opacity-40`;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-ink pt-4">
      <p className="font-mono text-small text-gray-600">
        Page {page} / {totalPages} · {total} {total === 1 ? noun.one : noun.many}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className={button}>
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={disabled}>
            Previous
          </span>
        )}
        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} className={button}>
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={disabled}>
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
