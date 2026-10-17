"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AvatarStack } from "./Avatars";
import { SavedCard, type Saved } from "./SavedCard";
import { api, labelOf } from "@/lib/client";
import { likedBy, namesLabel, useFriends } from "@/lib/friends";

export function SavedList() {
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const friends = useFriends();

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
            {shown.map((r, i) => {
              const fans = likedBy(friends, r.place_id);
              return (
                <SavedCard
                  key={r.place_id}
                  r={r}
                  index={i}
                  badge={fans.length > 0 && <AvatarStack friends={fans} label={`${namesLabel(fans)} liked this too`} />}
                />
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
