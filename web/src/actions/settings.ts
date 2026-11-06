"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { adminRequest } from "@/lib/session";
import type { User } from "@/types/api";

export type FormResult<Field extends string> = {
  result: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Partial<Record<Field, string>>;
};

function fieldErrorsFrom<Field extends string>(error: ApiError, fields: readonly Field[]) {
  const fieldErrors: Partial<Record<Field, string>> = {};
  for (const detail of error.details) {
    if ((fields as readonly string[]).includes(detail.field)) {
      fieldErrors[detail.field as Field] ??= detail.message;
    }
  }
  return fieldErrors;
}

const PROFILE_FIELDS = ["full_name", "email"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

// PATCH /api/auth/me as the signed-in admin.
export async function updateProfile(_previous: FormResult<ProfileField>, formData: FormData): Promise<FormResult<ProfileField>> {
  const body = {
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  try {
    await adminRequest<{ user: User }>("/api/auth/me", { method: "PATCH", body });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error; // includes the redirect to /login when the session ended
    }
    const fieldErrors = fieldErrorsFrom(error, PROFILE_FIELDS);
    if (error.status === 409) {
      fieldErrors.email = error.message;
    }
    return { result: "error", message: Object.keys(fieldErrors).length ? "Please fix the fields below." : error.message, fieldErrors };
  }
  revalidatePath("/", "layout"); // the sidebar shows the name and email
  return { result: "success", message: "Profile saved.", fieldErrors: {} };
}

const PASSWORD_FIELDS = ["current_password", "new_password", "confirm_password"] as const;
export type PasswordField = (typeof PASSWORD_FIELDS)[number];

// POST /api/auth/change-password. "Confirm" is only checked here; the backend applies the real rules.
export async function changePassword(_previous: FormResult<PasswordField>, formData: FormData): Promise<FormResult<PasswordField>> {
  const current_password = String(formData.get("current_password") ?? "");
  const new_password = String(formData.get("new_password") ?? "");
  if (new_password !== String(formData.get("confirm_password") ?? "")) {
    return { result: "error", message: "Please fix the fields below.", fieldErrors: { confirm_password: "The two new passwords don't match" } };
  }
  try {
    await adminRequest<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: { current_password, new_password },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
    const fieldErrors = fieldErrorsFrom(error, PASSWORD_FIELDS);
    return { result: "error", message: Object.keys(fieldErrors).length ? "Please fix the fields below." : error.message, fieldErrors };
  }
  return { result: "success", message: "Password changed. Use the new one next time you sign in.", fieldErrors: {} };
}
