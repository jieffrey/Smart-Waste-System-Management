import { Suspense } from "react";
import { CurrentAdmin } from "./CurrentAdmin";
import { NavLinks } from "./NavLinks";

export function Sidebar() {
  return (
    <aside className="flex w-full flex-col gap-6 border-b border-zinc-200 bg-white p-4 md:min-h-screen md:w-56 md:border-r md:border-b-0">
      <p className="font-semibold">Smart Waste Admin</p>
      <NavLinks />
      <div className="md:mt-auto">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <CurrentAdmin />
        </Suspense>
      </div>
    </aside>
  );
}
