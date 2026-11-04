"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { hasActiveUserFilters, usersHref, type UserFilters as Filters } from "@/lib/user-filters";

const inputClass = "rounded border border-zinc-300 bg-white px-2 py-1.5 text-small";

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
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <label className="flex flex-col gap-1 text-micro text-zinc-500">
        Search
        <SearchInput
          key={searchKey}
          value={filters.q ?? ""}
          onSearch={(q) => navigate({ q: q || undefined })}
          placeholder="Name or email"
          className={`${inputClass} w-56`}
        />
      </label>

      <label className="flex flex-col gap-1 text-micro text-zinc-500">
        Role
        <select
          value={filters.role ?? ""}
          onChange={(event) => navigate({ role: (event.target.value || undefined) as Filters["role"] })}
          className={inputClass}
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-micro text-zinc-500">
        Status
        <select
          value={filters.active ?? ""}
          onChange={(event) => navigate({ active: (event.target.value || undefined) as Filters["active"] })}
          className={inputClass}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Deactivated</option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => {
          setSearchKey((key) => key + 1);
          startTransition(() => router.push("/users"));
        }}
        disabled={!hasActiveUserFilters(filters)}
        className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-small hover:bg-zinc-100 disabled:opacity-50"
      >
        Reset filters
      </button>

      {pending && <p className="pb-1.5 text-small text-zinc-500">Updating…</p>}
    </div>
  );
}
