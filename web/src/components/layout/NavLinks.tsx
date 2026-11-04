"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/users", label: "Users" },
] as const;

// Highlights the current section. usePathname() is request data, so Sidebar renders this inside <Suspense>
// with <NavLinkList pathname={null} /> (same links, nothing highlighted) as the fallback.
export function NavLinks() {
  return <NavLinkList pathname={usePathname()} />;
}

// Active item: a red-orange bar (the "selected" color) and bold ink text. Horizontal on small screens.
export function NavLinkList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="flex gap-6 md:flex-col md:gap-0">
      {LINKS.map(({ href, label }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative py-1 text-body text-ink md:py-2 md:pl-4",
              "before:absolute before:bg-signal before:content-[''] max-md:before:inset-x-0 max-md:before:-bottom-4 max-md:before:h-1 md:before:inset-y-1 md:before:left-0 md:before:w-1",
              active ? "font-bold before:visible" : "before:invisible hover:underline"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
