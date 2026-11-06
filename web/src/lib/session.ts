import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "./api";
import { readTokenPayload, SESSION_COOKIE } from "./token";
import type { User } from "@/types/api";

// Why /login shows a message. proxy.ts clears the cookie when it sees one of these.
export type LogoutReason = "expired" | "deactivated" | "forbidden" | "logged-out";

// The token lives in an httpOnly cookie: browser JavaScript can never read it, only the Next server can.
export async function setSession(token: string) {
  const exp = readTokenPayload(token)?.exp;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: exp ? new Date(exp * 1000) : undefined,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

async function getToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

function reasonFor(error: ApiError): LogoutReason {
  if (error.status === 401) {
    return "expired";
  }
  return error.message.toLowerCase().includes("deactivated") ? "deactivated" : "forbidden";
}

// Sends the user to /login. Cookies can only be changed in Server Actions and Route Handlers, so during
// a page render the delete fails and proxy.ts clears the cookie when /login?reason=... loads.
async function endSession(reason: LogoutReason): Promise<never> {
  try {
    await clearSession();
  } catch {
    // Rendering a Server Component: proxy.ts handles it.
  }
  redirect(`/login?reason=${reason}`);
}

// Calls the backend as the logged-in admin. A 401 (expired/invalid token) or 403 (deactivated account
// or no longer an admin) ends the session.
export async function adminRequest<T>(path: string, options: Omit<Parameters<typeof apiRequest>[1], "token"> = {}) {
  const token = await getToken();
  if (!token) {
    return endSession("expired");
  }

  try {
    return await apiRequest<T>(path, { ...options, token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return endSession(reasonFor(error));
    }
    throw error;
  }
}

// When the current session token expires (read from the cookie; the backend still verifies the token).
export async function getSessionExpiry(): Promise<Date | null> {
  const token = await getToken();
  const exp = token ? readTokenPayload(token)?.exp : undefined;
  return exp ? new Date(exp * 1000) : null;
}

// The logged-in admin, checked against the backend on every request (catches deactivated accounts).
export async function getCurrentAdmin(): Promise<User> {
  const { user } = await adminRequest<{ user: User }>("/api/auth/me");
  if (user.role !== "admin") {
    return endSession("forbidden");
  }
  return user;
}
