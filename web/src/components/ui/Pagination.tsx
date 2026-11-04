import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  noun: { one: string; many: string }; // e.g. { one: "report", many: "reports" }
  hrefForPage: (page: number) => string;
};

const linkClass = "rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100";
const disabledClass = "rounded border border-zinc-200 px-3 py-1.5 text-zinc-400";

// Previous/Next links plus "Page X of Y · N items". A server component, so hrefForPage can be a function.
export function Pagination({ page, totalPages, total, noun, hrefForPage }: Props) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-small">
      <p className="text-zinc-600">
        Page {page} of {totalPages} · {total} {total === 1 ? noun.one : noun.many}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className={linkClass}>
            Previous
          </Link>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} className={linkClass}>
            Next
          </Link>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>
    </nav>
  );
}
