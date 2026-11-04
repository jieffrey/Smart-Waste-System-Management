import "server-only";
import { adminRequest } from "./session";
import { USERS_PAGE_SIZE, type UserFilters } from "./user-filters";
import type { AdminUser, Pagination } from "@/types/api";

// Server-side read of the user list (no caching), as the logged-in admin.
export function listUsers({ page, role, active, q }: UserFilters) {
  return adminRequest<{ users: AdminUser[]; pagination: Pagination }>("/api/admin/users", {
    query: { page, limit: USERS_PAGE_SIZE, role, is_active: active, q },
  });
}
