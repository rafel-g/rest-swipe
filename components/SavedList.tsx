"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRightIcon, PlateIcon } from "./icons";
import { api, labelOf, mapsUrl, photoUrl, priceLabel } from "@/lib/client";

type Saved = {
  place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  rating_count: number;
  price_level: number | null;
  cuisine: string | null;
  tags: string[];
  photo_name: string | null;
  website: string | null;
  maps_url: string | null;
  saved_at: string;
};

// Photo placeholders rotate through the palette's pastels so the grid isn't one flat color.
const TINTS = ["bg-peach", "bg-sage-2", "bg-soft", "bg-sage"];

export function SavedList() {
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    api<{ saved: Saved[] }>("/api/saved")
      .then((r) => setSaved(r.saved))
      .catch((e) => setError(e.message));
  }, []);

  // The most common tags among saved places become quick filters.
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of saved ?? []) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
  }, [saved]);

  const shown = tag ? (saved ?? []).filter((r) => r.tags.includes(tag)) : (saved ?? []);

  return (
    <>
      <header className="flex items-center gap-3 px-4 pb-2 pt-6">
        <h1 className="flex-1 text-[28px] font-extrabold tracking-tight">Your picks</h1>
        {saved && saved.length > 0 && (
          <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-card">{saved.length}</span>
        )}
      </header>

      {error ? (
        <p className="px-4 text-danger">{error}</p>
      ) : !saved ? (
        <p className="px-4 text-muted">Loading…</p>
      ) : saved.length === 0 ? (
        <div className="mx-4 mt-4 rounded-[28px] bg-card px-6 py-10 text-center">
          <p className="text-muted">Nothing saved yet.</p>
          <Link href="/swipe" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-semibold text-card">
            Start swiping
          </Link>
        </div>
      ) : (
        <>
          {topTags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2 [scrollbar-width:none]">
              {[null, ...topTags].map((t) => (
                <button
                  key={t ?? "all"}
                  onClick={() => setTag(t)}
                  aria-pressed={tag === t}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
                    tag === t ? "bg-ink text-card" : "bg-card text-ink hover:bg-soft"
                  }`}
                >
                  {t ? labelOf(t) : "Everything"}
                </button>
              ))}
            </div>
          )}
          <ul className="grid grid-cols-2 gap-3 px-4">
            {shown.map((r, i) => (
              <li key={r.place_id} className="flex flex-col overflow-hidden rounded-[26px] bg-card">
                <div className={`relative h-28 ${TINTS[i % TINTS.length]}`}>
                  {r.photo_name ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl(r.photo_name)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted/60">
                      <PlateIcon className="h-10 w-10" />
                    </div>
                  )}
                  {r.rating !== null && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-card px-2.5 py-0.5 text-xs font-bold">
                      ★ {r.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 px-3 pb-3 pt-2.5">
                  <p className="line-clamp-2 font-bold leading-tight">{r.name}</p>
                  <p className="text-[13px] font-medium text-muted">
                    {[r.cuisine && labelOf(r.cuisine), priceLabel(r.price_level)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-auto flex gap-3 pt-1.5 text-[13px] font-bold">
                    <a href={mapsUrl(r)} target="_blank" rel="noreferrer" className="flex min-h-7 items-center gap-0.5 hover:underline">
                      Directions <ArrowUpRightIcon className="h-3 w-3" />
                    </a>
                    {r.website && (
                      <a href={r.website} target="_blank" rel="noreferrer" className="flex min-h-7 items-center gap-0.5 hover:underline">
                        Site <ArrowUpRightIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
