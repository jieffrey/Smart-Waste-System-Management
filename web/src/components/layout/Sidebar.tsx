import { Suspense } from "react";
import Link from "next/link";
import { CurrentAdmin } from "./CurrentAdmin";
import { NavLinkList, NavLinks } from "./NavLinks";
import { PendingCount } from "./PendingCount";

// Light rail. The 1px ink rule belongs to this column, which stretches to the full page height, so the rule
// never stops; the content inside is sticky. On small screens it becomes a compact, sticky glass top bar (snow at
// 75% + backdrop blur, a faint rule): logo and account
// on one row, the nav underneath.
export function Sidebar() {
  const badges = {
    "/reports": (
      <Suspense fallback={null}>
        <PendingCount />
      </Suspense>
    ),
  };

  return (
    <aside className="sticky top-0 z-30 w-full shrink-0 border-b border-ink/15 bg-snow/75 backdrop-blur-md backdrop-saturate-150 md:static md:w-60 md:self-stretch md:border-r md:border-b-0 md:border-ink md:bg-snow md:backdrop-blur-none">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:items-stretch md:gap-6 md:px-0 md:py-8">
        <Link href="/dashboard" className="block w-fit md:px-6">
          <span className="tracking-display block text-title leading-none font-extrabold text-ink">SWMS</span>
          <span className="label-micro mt-1 block text-gray-600">Waste dispatch</span>
        </Link>
        <div className="col-span-2 row-start-2 -mx-3 md:mx-0">
          <Suspense fallback={<NavLinkList pathname={null} badges={badges} />}>
            <NavLinks badges={badges} />
          </Suspense>
        </div>
        <div className="md:mt-auto md:px-6">
          <Suspense fallback={<p className="text-small text-gray-600">Loading…</p>}>
            <CurrentAdmin />
          </Suspense>
        </div>
      </div>
    </aside>
  );
}
