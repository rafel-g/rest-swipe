"use client";

import Link from "next/link";
import { useState } from "react";
import { PinIcon, SlidersIcon } from "./icons";
import { EMPTY_FILTERS, type FilterOption, type Filters } from "@/lib/client";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
        active ? "bg-ink text-card" : "bg-card text-ink hover:bg-soft"
      }`}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
  cuisines,
  tags,
  location,
  radiusMi,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  cuisines: FilterOption[];
  tags: FilterOption[];
  location: string | null;
  radiusMi: number | null;
}) {
  const [open, setOpen] = useState(false);
  const extraCount =
    filters.tags.length + (filters.maxPrice !== null ? 1 : 0) + (filters.openNow ? 1 : 0) + (filters.includePassed ? 1 : 0);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="pb-3">
      <div className="flex items-center gap-2.5 px-4 pb-3">
        <Link
          href="/"
          className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-4 font-semibold"
          aria-label={`Change location (currently ${location ?? "not set"})`}
        >
          <PinIcon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{location ?? "Set your location"}</span>
          {radiusMi !== null && <span className="ml-auto shrink-0 font-medium text-muted">{radiusMi} mi</span>}
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={extraCount > 0 ? `Filters, ${extraCount} active` : "Filters"}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-card"
        >
          <SlidersIcon className="h-5 w-5" />
          {extraCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-on-coral">
              {extraCount}
            </span>
          )}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip active={filters.cuisine === null} onClick={() => set({ cuisine: null })}>
          All
        </Chip>
        {cuisines.map((c) => (
          <Chip key={c.value} active={filters.cuisine === c.value} onClick={() => set({ cuisine: c.value })}>
            {c.label} <span className="opacity-60">{c.count}</span>
          </Chip>
        ))}
      </div>

      {open && (
        <div className="mx-4 mt-2 space-y-3 rounded-3xl bg-soft p-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Max price</p>
            <div className="flex gap-2">
              {[null, 1, 2, 3, 4].map((p) => (
                <Chip key={String(p)} active={filters.maxPrice === p} onClick={() => set({ maxPrice: p })}>
                  {p === null ? "Any" : "$".repeat(p)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={filters.openNow} onClick={() => set({ openNow: !filters.openNow })}>
              Open now
            </Chip>
            <Chip active={filters.includePassed} onClick={() => set({ includePassed: !filters.includePassed })}>
              Show passed again
            </Chip>
          </div>
          {tags.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Must have</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const active = filters.tags.includes(t.value);
                  return (
                    <Chip
                      key={t.value}
                      active={active}
                      onClick={() =>
                        set({ tags: active ? filters.tags.filter((x) => x !== t.value) : [...filters.tags, t.value] })
                      }
                    >
                      {t.label}
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}
          {extraCount > 0 && (
            <button
              onClick={() => onChange({ ...EMPTY_FILTERS, cuisine: filters.cuisine })}
              className="text-sm font-semibold underline underline-offset-2"
            >
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
