"use client";

import { useState } from "react";
import { EMPTY_FILTERS, type FilterOption, type Filters } from "@/lib/client";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
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
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  cuisines: FilterOption[];
  tags: FilterOption[];
}) {
  const [open, setOpen] = useState(false);
  const extraCount =
    filters.tags.length + (filters.maxPrice !== null ? 1 : 0) + (filters.openNow ? 1 : 0) + (filters.includePassed ? 1 : 0);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="pb-3">
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip active={open || extraCount > 0} onClick={() => setOpen((o) => !o)}>
          ⚙︎ Filters{extraCount > 0 ? ` (${extraCount})` : ""}
        </Chip>
        <Chip active={filters.cuisine === null} onClick={() => set({ cuisine: null })}>
          All
        </Chip>
        {cuisines.map((c) => (
          <Chip key={c.value} active={filters.cuisine === c.value} onClick={() => set({ cuisine: c.value })}>
            {c.label} <span className="opacity-50">{c.count}</span>
          </Chip>
        ))}
      </div>

      {open && (
        <div className="mx-4 mt-2 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Max price</p>
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
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Must have</p>
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
              className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
