"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, setSession } from "@/lib/session";
import type { LoginResponse } from "@/types/api";

export type LoginField = "email" | "password";

export type LoginState = {
  message: string | null;
  fieldErrors: Partial<Record<LoginField, string>>;
  email: string;
};

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  let result: LoginResponse;
  try {
    result = await apiRequest<LoginResponse>("/api/auth/login", { method: "POST", body: { email, password } });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const detail of error.details) {
      if (detail.field === "email" || detail.field === "password") {
        fieldErrors[detail.field] ??= detail.message;
      }
    }
    const message = error.details.length > 0 ? "Please fix the fields below." : error.message;
    return { message, fieldErrors, email };
  }

  // Checked before any cookie is set, so a non-admin never gets a session here.
  if (result.user.role !== "admin") {
    return {
      message: "This account is not an admin. Regular users sign in through the mobile app.",
      fieldErrors: {},
      email,
    };
  }

  await setSession(result.token);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  revalidatePath("/", "layout");
  redirect("/login?reason=logged-out");
}
