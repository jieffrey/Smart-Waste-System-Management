// Shared by proxy.ts and lib/session.ts. Only reads the JWT payload: it cannot verify the signature
// (the secret stays on the backend), so the backend still checks every token on every request.

export const SESSION_COOKIE = "swms_admin_token";

type TokenPayload = { sub?: string; role?: string; exp?: number };

export function readTokenPayload(token: string): TokenPayload | null {
  try {
    const part = token.split(".")[1];
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as TokenPayload;
  } catch {
    return null;
  }
}

// True when the token looks like an admin token that has not expired yet.
export function isUsableAdminToken(token: string): boolean {
  const payload = readTokenPayload(token);
  return payload?.role === "admin" && typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
}
