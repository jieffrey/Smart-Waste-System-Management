import { logout } from "@/actions/auth";
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
    <div className="space-y-2">
      {admin ? (
        <div className="text-sm">
          <p className="font-medium">{admin.full_name}</p>
          <p className="truncate text-zinc-500">{admin.email}</p>
        </div>
      ) : (
        <p className="text-sm text-red-700">Couldn&apos;t load your account.</p>
      )}
      <form action={logout}>
        <button type="submit" className="w-full rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
          Log out
        </button>
      </form>
    </div>
  );
}
