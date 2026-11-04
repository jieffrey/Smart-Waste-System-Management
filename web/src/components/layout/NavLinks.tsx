"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function NavLinkList({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-2 text-small ${active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
