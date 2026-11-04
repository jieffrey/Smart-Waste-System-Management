"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, REPORT_CATEGORIES, REPORT_STATUSES, STATUS_LABELS } from "@/lib/labels";
import { hasActiveFilters, reportsHref, type ReportFilters as Filters } from "@/lib/report-filters";
import { SearchInput } from "@/components/ui/SearchInput";

const inputClass = "rounded border border-zinc-300 bg-white px-2 py-1.5 text-small";

// All filter state lives in the URL: every change navigates to a new /reports?... URL (page back to 1),
// so filtered views can be shared and the back button works.
export function ReportFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Bumped by "Reset filters" to remount the search box, which clears any text typed but not yet searched.
  const [searchKey, setSearchKey] = useState(0);

  function navigate(changes: Partial<Filters>) {
    startTransition(() => {
      router.push(reportsHref({ ...filters, ...changes, page: 1 }));
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <label className="flex flex-col gap-1 text-micro text-zinc-500">
        Search
        <SearchInput
          key={searchKey}
          value={filters.q ?? ""}
          onSearch={(q) => navigate({ q: q || undefined })}
          placeholder="Description or address"
          className={`${inputClass} w-56`}
        />
      </label>

      <label className="flex flex-col gap-1 text-micro text-zinc-500">
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

      <label className="flex flex-col gap-1 text-micro text-zinc-500">
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

      <label className="flex flex-col gap-1 text-micro text-zinc-500">
        From (WIB)
        <input
          type="date"
          value={filters.from ?? ""}
          max={filters.to}
          onChange={(event) => navigate({ from: event.target.value || undefined })}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-micro text-zinc-500">
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
          setSearchKey((key) => key + 1);
          startTransition(() => router.push("/reports"));
        }}
        disabled={!hasActiveFilters(filters)}
        className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-small hover:bg-zinc-100 disabled:opacity-50"
      >
        Reset filters
      </button>

      {pending && <p className="pb-1.5 text-small text-zinc-500">Updating…</p>}
    </div>
  );
}
