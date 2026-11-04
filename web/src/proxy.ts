import { NextResponse, type NextRequest } from "next/server";
import { isUsableAdminToken, SESSION_COOKIE } from "@/lib/token";

// Runs before every page. A quick first check on the session cookie (present, admin, not expired);
// the backend still verifies the token on every API call (see lib/session.ts).
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasValidSession = token !== undefined && isUsableAdminToken(token);

  if (pathname === "/login") {
    // /login?reason=... means the session ended (expired, deactivated, ...): clear the cookie.
    if (token !== undefined && (searchParams.has("reason") || !hasValidSession)) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    if (hasValidSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasValidSession) {
    const loginUrl = new URL("/login", request.url);
    if (token !== undefined) {
      loginUrl.searchParams.set("reason", "expired");
    }
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Every page except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
