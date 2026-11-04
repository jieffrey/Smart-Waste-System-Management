"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";
import { hasActiveUserFilters, usersHref, type UserFilters as Filters } from "@/lib/user-filters";

const compactField = cn(fieldClass, "h-8 text-small");

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="label-micro text-gray-600">{label}</span>
      {children}
    </label>
  );
}

// Same approach as ReportFilters: all filter state lives in the URL, and any change goes back to page 1.
export function UserFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchKey, setSearchKey] = useState(0);

  function navigate(changes: Partial<Filters>) {
    startTransition(() => {
      router.push(usersHref({ ...filters, ...changes, page: 1 }));
    });
  }

  return (
    <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(12rem,22rem)_9rem_10rem_auto]">
      <Field label="Search" className="col-span-2 lg:col-span-1">
        <SearchInput
          key={searchKey}
          value={filters.q ?? ""}
          onSearch={(q) => navigate({ q: q || undefined })}
          placeholder="Name or email"
          className={compactField}
        />
      </Field>

      <Field label="Role">
        <NativeSelect
          size="sm"
          value={filters.role ?? ""}
          onChange={(event) => navigate({ role: (event.target.value || undefined) as Filters["role"] })}
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          <NativeSelectOption value="user">User</NativeSelectOption>
          <NativeSelectOption value="admin">Admin</NativeSelectOption>
        </NativeSelect>
      </Field>

      <Field label="Status">
        <NativeSelect
          size="sm"
          value={filters.active ?? ""}
          onChange={(event) => navigate({ active: (event.target.value || undefined) as Filters["active"] })}
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          <NativeSelectOption value="true">Active</NativeSelectOption>
          <NativeSelectOption value="false">Deactivated</NativeSelectOption>
        </NativeSelect>
      </Field>

      <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-0"
          onClick={() => {
            setSearchKey((key) => key + 1);
            startTransition(() => router.push("/users"));
          }}
          disabled={!hasActiveUserFilters(filters)}
        >
          Reset filters
        </Button>
        {pending && <span className="font-mono text-micro text-gray-600">Updating…</span>}
      </div>
    </div>
  );
}
