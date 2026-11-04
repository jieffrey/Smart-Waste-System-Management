import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { UserFilters } from "@/components/users/UserFilters";
import { UsersTable } from "@/components/users/UsersTable";
import { listUsers } from "@/lib/users-data";
import { ApiError } from "@/lib/api";
import { getCurrentAdmin } from "@/lib/session";
import {
  hasActiveUserFilters,
  parseUserFilters,
  USERS_PAGE_SIZE,
  usersHref,
  type UserFilters as Filters,
} from "@/lib/user-filters";

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading users…</p>}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function UsersContent({ searchParams }: { searchParams: PageProps<"/users">["searchParams"] }) {
  const filters = parseUserFilters(await searchParams);

  return (
    <div className="space-y-4">
      <UserFilters filters={filters} />
      {/* Keyed by the URL, so changing a filter shows the loading state for the results only. */}
      <Suspense key={usersHref(filters)} fallback={<p className="text-sm text-zinc-500">Loading users…</p>}>
        <UsersResults filters={filters} />
      </Suspense>
    </div>
  );
}

async function UsersResults({ filters }: { filters: Filters }) {
  let data: Awaited<ReturnType<typeof listUsers>>;
  let currentAdminId: string | null;
  try {
    [data, currentAdminId] = await Promise.all([listUsers(filters), getCurrentAdmin().then((admin) => admin.id)]);
  } catch (error) {
    // Only API errors become an error state; redirects (expired session) must pass through.
    if (error instanceof ApiError) {
      return <ErrorState title="Couldn't load the users" message={error.message} />;
    }
    throw error;
  }

  const { users, pagination } = data;
  const totalPages = Math.max(1, Math.ceil(pagination.total / USERS_PAGE_SIZE));

  // A page past the end (e.g. ?page=999 or after filtering): go to the last page that exists.
  if (users.length === 0 && filters.page > totalPages) {
    redirect(usersHref({ ...filters, page: totalPages }));
  }

  if (pagination.total === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        {hasActiveUserFilters(filters) ? "No users match these filters." : "No users yet."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <UsersTable users={users} currentAdminId={currentAdminId} />
      <Pagination
        page={filters.page}
        totalPages={totalPages}
        total={pagination.total}
        noun={{ one: "user", many: "users" }}
        hrefForPage={(page) => usersHref({ ...filters, page })}
      />
    </div>
  );
}
