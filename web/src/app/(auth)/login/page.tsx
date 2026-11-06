import { Suspense } from "react";
import { Info } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { CategorySwatch } from "@/components/ui/CategorySwatch";
import { REPORT_CATEGORIES } from "@/lib/labels";

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
    <p role="status" className="flex gap-2 border-l-4 border-ink py-1 pl-3 text-small text-ink">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

// Facts shown on the front door. All true for this system (the accuracy is the served model's test result,
// Option B, see ml/README.md). Hidden on phones so the sign-in form is in the first screen.
function Facts() {
  return (
    <dl className="hidden gap-6 border-t border-gray-700 pt-6 sm:grid sm:grid-cols-3">
      <div>
        <dt className="font-mono text-title font-semibold text-highlight">3</dt>
        <dd className="mt-1 text-small text-gray-300">
          waste streams the AI sorts into
          <span className="mt-2 flex gap-1.5" aria-hidden="true">
            {REPORT_CATEGORIES.map((category) => (
              <CategorySwatch key={category} category={category} framed />
            ))}
          </span>
        </dd>
      </div>
      <div>
        <dt className="font-mono text-title font-semibold text-highlight">98.3%</dt>
        <dd className="mt-1 text-small text-gray-300">test accuracy of the classifier on 701 held-out photos</dd>
      </div>
      <div>
        <dt className="font-mono text-title font-semibold text-highlight">4</dt>
        <dd className="mt-1 text-small text-gray-300">steps every reporter can follow, from pending to resolved</dd>
      </div>
    </dl>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[7fr_5fr]">
      {/* The concept, in one sentence */}
      <section className="flex flex-col justify-between gap-6 bg-ink px-6 py-6 text-snow sm:gap-12 sm:px-12 sm:py-12">
        <div>
          <p className="font-wide text-heading font-extrabold tracking-tight">SWMS</p>
          <p className="label-micro mt-1 text-gray-300">Smart Waste Management System</p>
        </div>
        <h1 className="font-semiwide max-w-3xl text-title leading-tight font-bold tracking-tight sm:text-display sm:leading-none">
          Residents spot it. The AI sorts it. <span className="text-highlight">You dispatch it.</span>
        </h1>
        <Facts />
      </section>

      {/* The door */}
      <section className="flex items-start px-6 py-8 sm:px-12 sm:py-12 lg:items-center">
        <div className="w-full max-w-sm space-y-8">
          <div className="border-b-2 border-ink pb-4">
            <p className="label-micro text-gray-600">Admin</p>
            <h2 className="font-semiwide mt-1 text-title font-bold tracking-tight text-ink">Sign in</h2>
            <p className="mt-2 text-small text-gray-700">For dispatchers with an admin account. Residents use the mobile app.</p>
          </div>
          <Suspense fallback={null}>
            <ReasonNotice searchParams={searchParams} />
          </Suspense>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
