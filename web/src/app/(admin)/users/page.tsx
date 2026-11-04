import { Suspense } from "react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <section className="space-y-8">
      <PageHeader title="Users" description="Residents who report waste, and the admins who dispatch it." />
      <Suspense fallback={<p className="text-small text-gray-600">Loading users…</p>}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function UsersContent({ searchParams }: { searchParams: PageProps<"/users">["searchParams"] }) {
  const filters = parseUserFilters(await searchParams);

  return (
    <div className="space-y-6">
      <UserFilters filters={filters} />
      {/* Keyed by the URL, so changing a filter shows the loading state for the results only. */}
      <Suspense key={usersHref(filters)} fallback={<p className="text-small text-gray-600">Loading users…</p>}>
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
      <EmptyState
        title={hasActiveUserFilters(filters) ? "No users match these filters." : "No users yet."}
        hint={hasActiveUserFilters(filters) ? "Try another role or status, or reset the filters." : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
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
