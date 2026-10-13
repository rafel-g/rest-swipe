"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export function SavedList() {
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ saved: Saved[] }>("/api/saved")
      .then((r) => setSaved(r.saved))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="px-4 text-rose-600">{error}</p>;
  if (!saved) return <p className="px-4 text-zinc-500">Loading…</p>;
  if (saved.length === 0)
    return (
      <div className="px-4 text-center text-zinc-600 dark:text-zinc-400">
        <p>Nothing saved yet.</p>
        <Link href="/swipe" className="mt-3 inline-block font-semibold text-sky-600 dark:text-sky-400">
          Start swiping →
        </Link>
      </div>
    );

  return (
    <ul className="space-y-3 px-4">
      {saved.map((r) => (
        <li key={r.place_id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
            {r.photo_name ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl(r.photo_name)} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl">🍽️</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{r.name}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {[r.cuisine && labelOf(r.cuisine), r.rating !== null && `★ ${r.rating.toFixed(1)}`, priceLabel(r.price_level)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {r.address && <p className="truncate text-xs text-zinc-500">{r.address}</p>}
            <div className="mt-1.5 flex gap-4 text-sm font-medium">
              <a href={mapsUrl(r)} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline dark:text-sky-400">
                Directions ↗
              </a>
              {r.website && (
                <a href={r.website} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline dark:text-sky-400">
                  Website ↗
                </a>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
