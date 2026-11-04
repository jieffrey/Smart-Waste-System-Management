import { Suspense } from "react";
import Link from "next/link";
import { CurrentAdmin } from "./CurrentAdmin";
import { NavLinkList, NavLinks } from "./NavLinks";

// Left rail on desktop, a top bar on small screens. A 1px ink rule separates it from the content.
export function Sidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-ink bg-snow px-4 py-4 md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0 md:px-6 md:py-8">
      <Link href="/dashboard" className="block w-fit">
        <span className="font-wide block text-heading leading-none font-extrabold tracking-tight text-ink">SWMS</span>
        <span className="label-micro mt-1 block text-gray-600">Waste dispatch</span>
      </Link>
      <Suspense fallback={<NavLinkList pathname={null} />}>
        <NavLinks />
      </Suspense>
      <div className="md:mt-auto">
        <Suspense fallback={<p className="text-small text-gray-600">Loading…</p>}>
          <CurrentAdmin />
        </Suspense>
      </div>
    </aside>
  );
}
