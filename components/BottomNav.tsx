"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookmarkIcon, CardsIcon, PinIcon, UsersIcon } from "./icons";

const TABS = [
  { href: "/swipe", label: "Swipe", Icon: CardsIcon },
  { href: "/saved", label: "Saved", Icon: BookmarkIcon },
  { href: "/together", label: "Together", Icon: UsersIcon },
  { href: "/", label: "Location", Icon: PinIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 bg-ground pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto mb-3 flex max-w-md gap-1 px-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={`flex min-h-12 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition ${
                  active ? "bg-ink text-card" : "text-muted hover:bg-sage-2"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {/* Four tabs don't fit labels next to icons on the narrowest phones. */}
                <span className="hidden min-[360px]:inline">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
