import { Suspense } from "react";
import Link from "next/link";
import { CurrentAdmin } from "./CurrentAdmin";
import { NavLinkList, NavLinks } from "./NavLinks";
import { PendingCount } from "./PendingCount";

// Light rail. The 1px ink rule belongs to this column, which stretches to the full page height, so the rule
// never stops; the content inside is sticky. On small screens it becomes a top bar.
export function Sidebar() {
  const badges = {
    "/reports": (
      <Suspense fallback={null}>
        <PendingCount />
      </Suspense>
    ),
  };

  return (
    <aside className="w-full shrink-0 border-b border-ink bg-snow md:w-60 md:self-stretch md:border-r md:border-b-0">
      <div className="flex flex-col gap-6 px-4 py-4 md:sticky md:top-0 md:h-screen md:px-0 md:py-8">
        <Link href="/dashboard" className="block w-fit md:px-6">
          <span className="font-wide block text-title leading-none font-extrabold tracking-tight text-ink">SWMS</span>
          <span className="label-micro mt-1 block text-gray-600">Waste dispatch</span>
        </Link>
        <Suspense fallback={<NavLinkList pathname={null} badges={badges} />}>
          <NavLinks badges={badges} />
        </Suspense>
        <div className="md:mt-auto md:px-6">
          <Suspense fallback={<p className="text-small text-gray-600">Loading…</p>}>
            <CurrentAdmin />
          </Suspense>
        </div>
      </div>
    </aside>
  );
}
