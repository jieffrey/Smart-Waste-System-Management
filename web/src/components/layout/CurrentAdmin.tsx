import { logout } from "@/actions/auth";
import { getCurrentAdmin } from "@/lib/session";

// Checks the session against the backend on every request; redirects to /login if it is no longer valid.
export async function CurrentAdmin() {
  const admin = await getCurrentAdmin();

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <p className="font-medium">{admin.full_name}</p>
        <p className="truncate text-zinc-500">{admin.email}</p>
      </div>
      <form action={logout}>
        <button type="submit" className="w-full rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
          Log out
        </button>
      </form>
    </div>
  );
}
