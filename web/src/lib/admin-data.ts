import "server-only";
import { adminRequest } from "./session";
import type { Stats } from "@/types/api";

// Server-side reads of admin data. Each call goes to the backend (no caching) as the logged-in admin.

export function getStats() {
  return adminRequest<Stats>("/api/admin/stats");
}
