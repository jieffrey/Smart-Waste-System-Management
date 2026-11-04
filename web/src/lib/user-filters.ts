// Filters for /users live in the URL (same approach as report-filters.ts). Invalid values are dropped,
// so a hand-edited URL never breaks the page. Used on the server and in the browser.
import type { Role } from "@/types/api";

export const USERS_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100; // same limit as the backend

export type UserFilters = {
  role?: Role;
  active?: "true" | "false"; // sent to the backend as is_active
  q?: string; // name or email
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseUserFilters(params: SearchParams): UserFilters {
  const role = first(params.role);
  const active = first(params.active);
  const page = Number(first(params.page));

  return {
    role: role === "admin" || role === "user" ? role : undefined,
    active: active === "true" || active === "false" ? active : undefined,
    q: first(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export function hasActiveUserFilters(filters: UserFilters) {
  return Boolean(filters.role || filters.active || filters.q);
}

// Link to /users with these filters. Empty values and page 1 are left out to keep URLs short.
export function usersHref(filters: Partial<UserFilters>) {
  const params = new URLSearchParams();
  for (const key of ["role", "active", "q"] as const) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const query = params.toString();
  return query ? `/users?${query}` : "/users";
}
