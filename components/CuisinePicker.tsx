"use client";

import { useId, useState } from "react";
import { CUISINES, label } from "@/lib/taxonomy";
import { ChevronDownIcon } from "./icons";

const OPTIONS = CUISINES.filter((c) => c !== "other");

/** Multi-select dropdown of cuisines. An empty selection means "no preference". */
export function CuisinePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const summary =
    value.length === 0
      ? "Any cuisine"
      : value.length <= 2
        ? value.map(label).join(", ")
        : `${value.slice(0, 2).map(label).join(", ")} +${value.length - 2}`;
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center rounded-2xl border-2 border-line bg-soft px-4 py-3 text-left focus:border-ink"
      >
        <span className={`truncate ${value.length === 0 ? "text-muted" : ""}`}>{summary}</span>
        <ChevronDownIcon className={`ml-auto h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={panelId} className="mt-2 rounded-2xl bg-soft p-3">
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((c) => {
              const active = value.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(c)}
                  aria-pressed={active}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                    active ? "bg-ink text-card" : "bg-card text-ink hover:bg-line"
                  }`}
                >
                  {label(c)}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            {value.length > 0 ? (
              <button type="button" onClick={() => onChange([])} className="text-sm font-semibold underline underline-offset-2">
                Clear
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-card">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
