"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SearchInput } from "@/components/ui/SearchInput";
import { CATEGORY_LABELS, REPORT_CATEGORIES, REPORT_STATUSES, STATUS_LABELS } from "@/lib/labels";
import { hasActiveFilters, reportsHref, type ReportFilters as Filters } from "@/lib/report-filters";
import { cn } from "@/lib/utils";

const compactField = cn(fieldClass, "h-8 text-small");

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="label-micro text-gray-600">{label}</span>
      {children}
    </label>
  );
}

// All filter state lives in the URL: every change navigates to a new /reports?... URL (page back to 1),
// so filtered views can be shared and the back button works. One compact row on desktop.
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
    <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(12rem,1fr)_10rem_9rem_9.5rem_9.5rem_auto]">
      <Field label="Search" className="col-span-2 lg:col-span-1">
        <SearchInput
          key={searchKey}
          value={filters.q ?? ""}
          onSearch={(q) => navigate({ q: q || undefined })}
          placeholder="Description or address"
          className={compactField}
        />
      </Field>

      <Field label="Status">
        <NativeSelect
          size="sm"
          value={filters.status ?? ""}
          onChange={(event) => navigate({ status: (event.target.value || undefined) as Filters["status"] })}
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          {REPORT_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {STATUS_LABELS[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field label="Category">
        <NativeSelect
          size="sm"
          value={filters.category ?? ""}
          onChange={(event) => navigate({ category: (event.target.value || undefined) as Filters["category"] })}
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          {REPORT_CATEGORIES.map((category) => (
            <NativeSelectOption key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field label="From (WIB)">
        <input
          type="date"
          value={filters.from ?? ""}
          max={filters.to}
          onChange={(event) => navigate({ from: event.target.value || undefined })}
          className={cn(compactField, "font-mono")}
        />
      </Field>

      <Field label="To (WIB)">
        <input
          type="date"
          value={filters.to ?? ""}
          min={filters.from}
          onChange={(event) => navigate({ to: event.target.value || undefined })}
          className={cn(compactField, "font-mono")}
        />
      </Field>

      <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-0"
          onClick={() => {
            setSearchKey((key) => key + 1);
            startTransition(() => router.push("/reports"));
          }}
          disabled={!hasActiveFilters(filters)}
        >
          Reset filters
        </Button>
        {pending && <span className="font-mono text-micro text-gray-600">Updating…</span>}
      </div>
    </div>
  );
}
