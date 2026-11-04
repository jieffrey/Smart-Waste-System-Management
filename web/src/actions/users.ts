"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { adminRequest } from "@/lib/session";
import type { AdminUser } from "@/types/api";

export type UserActiveState = { result: "idle" | "success" | "error"; message: string | null };

// Activates or deactivates a user (PATCH /api/admin/users/:id). A deactivated user is signed out of the
// mobile app on their next request, because the backend checks is_active every time.
export async function setUserActive(_previous: UserActiveState, formData: FormData): Promise<UserActiveState> {
  const userId = String(formData.get("user_id") ?? "");
  const isActive = formData.get("is_active") === "true";

  try {
    await adminRequest<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { is_active: isActive },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error; // includes the redirect to /login when the session ended
    }
    if (error.status === 404) {
      revalidatePath("/users");
      return { result: "error", message: "This user no longer exists." };
    }
    // e.g. 400 "You cannot deactivate your own account" (the button is hidden on your own row anyway)
    return { result: "error", message: error.message };
  }

  revalidatePath("/users");
  revalidatePath("/dashboard");
  return { result: "success", message: isActive ? "User activated." : "User deactivated." };
}
