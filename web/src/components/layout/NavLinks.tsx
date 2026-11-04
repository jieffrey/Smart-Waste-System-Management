"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/users", label: "Users" },
] as const;

type Badges = Partial<Record<(typeof LINKS)[number]["href"], React.ReactNode>>;

// Highlights the current section. usePathname() is request data, so Sidebar renders this inside <Suspense>
// with <NavLinkList pathname={null} /> (same links, nothing highlighted) as the fallback.
export function NavLinks({ badges }: { badges?: Badges }) {
  return <NavLinkList pathname={usePathname()} badges={badges} />;
}

// Active item: a yellow field with a 3px ink bar on the left. It slides between items (shared layoutId);
// with reduced motion it simply jumps (MotionConfig in the admin layout).
export function NavLinkList({ pathname, badges }: { pathname: string | null; badges?: Badges }) {
  return (
    <nav aria-label="Main" className="flex gap-1 md:flex-col md:gap-0">
      {LINKS.map(({ href, label }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-between gap-3 px-3 py-2 text-body text-ink md:py-2.5 md:pl-4",
              active ? "font-bold" : "hover:bg-gray-50"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 border-l-[3px] border-ink bg-highlight"
                transition={{ type: "tween", duration: 0.25, ease: [0.2, 0, 0, 1] }}
                aria-hidden="true"
              />
            )}
            <span className="relative">{label}</span>
            {badges?.[href] && <span className="relative">{badges[href]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
