"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, REPORT_CATEGORIES, REPORT_STATUSES, STATUS_LABELS } from "@/lib/labels";
import { hasActiveFilters, reportsHref, type ReportFilters as Filters } from "@/lib/report-filters";

const SEARCH_DELAY_MS = 400;
const inputClass = "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm";

// All filter state lives in the URL: every change navigates to a new /reports?... URL (page back to 1),
// so filtered views can be shared and the back button works.
export function ReportFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // The search box keeps its own text while typing; the URL is updated after a pause.
  const urlQ = filters.q ?? "";
  const [search, setSearch] = useState(urlQ);
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  const [pushedQ, setPushedQ] = useState(urlQ);
  // When the URL's q changes because of something other than our own search (back button, reset),
  // show the URL's value. When it's the value we just pushed, keep what the user has typed since.
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    if (urlQ !== pushedQ) {
      setSearch(urlQ);
      setPushedQ(urlQ);
    }
  }

  function navigate(changes: Partial<Filters>) {
    startTransition(() => {
      router.push(reportsHref({ ...filters, ...changes, page: 1 }));
    });
  }

  useEffect(() => {
    const q = search.trim();
    if (q === (filters.q ?? "")) {
      return;
    }
    const timer = setTimeout(() => {
      setPushedQ(q);
      startTransition(() => {
        router.push(reportsHref({ ...filters, q: q || undefined, page: 1 }));
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, filters, router]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Search
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Description or address"
          maxLength={100}
          className={`${inputClass} w-56`}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Status
        <select
          value={filters.status ?? ""}
          onChange={(event) => navigate({ status: (event.target.value || undefined) as Filters["status"] })}
          className={inputClass}
        >
          <option value="">All statuses</option>
          {REPORT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Category
        <select
          value={filters.category ?? ""}
          onChange={(event) => navigate({ category: (event.target.value || undefined) as Filters["category"] })}
          className={inputClass}
        >
          <option value="">All categories</option>
          {REPORT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        From (WIB)
        <input
          type="date"
          value={filters.from ?? ""}
          max={filters.to}
          onChange={(event) => navigate({ from: event.target.value || undefined })}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        To (WIB)
        <input
          type="date"
          value={filters.to ?? ""}
          min={filters.from}
          onChange={(event) => navigate({ to: event.target.value || undefined })}
          className={inputClass}
        />
      </label>

      <button
        type="button"
        onClick={() => {
          setSearch("");
          setPushedQ("");
          startTransition(() => router.push("/reports"));
        }}
        disabled={!hasActiveFilters(filters)}
        className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        Reset filters
      </button>

      {pending && <p className="pb-1.5 text-sm text-zinc-500">Updating…</p>}
    </div>
  );
}
