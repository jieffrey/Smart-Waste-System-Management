import { AlertTriangle } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { getCurrentAdmin } from "@/lib/session";
import type { User } from "@/types/api";

// Checks the session against the backend on every request; redirects to /login if it is no longer valid.
// If the backend can't be reached, the sidebar still renders (with a logout button) instead of crashing the page.
export async function CurrentAdmin() {
  let admin: User | null = null;
  try {
    admin = await getCurrentAdmin();
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }
  }

  return (
    <div className="flex items-center gap-3 md:block md:space-y-3 md:border-t md:border-ink md:pt-4">
      {admin ? (
        <div>
          <p className="text-small font-semibold text-ink">{admin.full_name}</p>
          <p className="hidden truncate font-mono text-micro text-gray-600 md:block">{admin.email}</p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-small text-ink">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Couldn&apos;t load your account.
        </p>
      )}
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" className="px-0">
          Log out
        </Button>
      </form>
    </div>
  );
}
