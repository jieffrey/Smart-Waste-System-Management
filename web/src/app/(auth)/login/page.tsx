import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

const REASON_MESSAGES: Record<string, string> = {
  expired: "Your session has expired. Please sign in again.",
  deactivated: "Your account has been deactivated. Contact another admin.",
  forbidden: "This account no longer has admin access.",
  "logged-out": "You have been signed out.",
};

// Reads ?reason=... at request time, so it sits behind its own Suspense boundary.
async function ReasonNotice({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { reason } = await searchParams;
  const message = typeof reason === "string" ? REASON_MESSAGES[reason] : undefined;
  if (!message) {
    return null;
  }
  return (
    <p role="status" className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-small text-amber-800">
      {message}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-title font-semibold">Smart Waste Admin</h1>
          <p className="text-small text-zinc-500">Sign in with an admin account.</p>
        </div>
        <Suspense fallback={null}>
          <ReasonNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </div>
    </main>
  );
}
