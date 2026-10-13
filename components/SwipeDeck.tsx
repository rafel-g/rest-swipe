"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RestaurantCard, type CardHandle } from "./RestaurantCard";
import { FilterBar } from "./FilterBar";
import { api, ApiError, EMPTY_FILTERS, type Card, type FilterOption, type Filters } from "@/lib/client";

const PAGE_SIZE = 10;
const REFILL_AT = 3;
const VISIBLE = 3;

type FilterData = {
  cuisines: FilterOption[];
  tags: FilterOption[];
  total: number;
  untagged: number;
  location: string | null;
  radiusMi: number;
};

function deckQuery(f: Filters, limit: number) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (f.cuisine) q.set("cuisine", f.cuisine);
  if (f.tags.length) q.set("tags", f.tags.join(","));
  if (f.maxPrice !== null) q.set("maxPrice", String(f.maxPrice));
  if (f.openNow) q.set("openNow", "true");
  if (f.includePassed) q.set("includePassed", "true");
  return q.toString();
}

export function SwipeDeck() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterData, setFilterData] = useState<FilterData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [history, setHistory] = useState<Card[]>([]);

  const topRef = useRef<CardHandle>(null);
  // Swipes are sent one at a time so preference updates never race each other,
  // and a refill waits for them so it doesn't return cards we just swiped.
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const swipedIds = useRef(new Set<string>());
  const filtersRef = useRef(filters);
  const fetching = useRef(false);
  const generation = useRef(0);

  /**
   * Fetch the next page and append unseen cards. The server ranks everything not yet swiped,
   * so the cards we already hold come back first; asking for `held` extra guarantees a full
   * page of new ones. Only sets state after awaiting.
   */
  const loadMore = useCallback(async (held: number) => {
    if (fetching.current) return;
    fetching.current = true;
    const gen = generation.current;
    const limit = Math.min(50, held + PAGE_SIZE);
    try {
      await pending.current;
      const { cards: next } = await api<{ cards: Card[] }>(`/api/deck?${deckQuery(filtersRef.current, limit)}`);
      if (gen !== generation.current) return; // filters changed while loading
      setCards((prev) => {
        const have = new Set(prev.map((c) => c.place_id));
        return [...prev, ...next.filter((c) => !have.has(c.place_id) && !swipedIds.current.has(c.place_id))];
      });
      // A short page means the server has nothing beyond what we now hold.
      setExhausted(next.length < limit);
      setError(null);
    } catch (e) {
      if (gen !== generation.current) return;
      setError({ message: e instanceof Error ? e.message : "Something went wrong", code: e instanceof ApiError ? e.code : undefined });
    } finally {
      if (gen === generation.current) {
        setLoading(false);
        fetching.current = false;
      }
    }
  }, []);

  useEffect(() => {
    api<FilterData>("/api/filters")
      .then(setFilterData)
      .catch(() => {});
    void loadMore(0);
  }, [loadMore]);

  /** Start over with new filters. */
  const changeFilters = useCallback(
    (next: Filters | ((f: Filters) => Filters)) => {
      const value = typeof next === "function" ? next(filtersRef.current) : next;
      filtersRef.current = value;
      generation.current++;
      fetching.current = false;
      swipedIds.current = new Set();
      setFilters(value);
      setCards([]);
      setExhausted(false);
      setError(null);
      setLoading(true);
      void loadMore(0);
    },
    [loadMore],
  );

  const retry = useCallback(() => changeFilters(filtersRef.current), [changeFilters]);

  const decide = useCallback(
    (card: Card, decision: "yes" | "no") => {
      swipedIds.current.add(card.place_id);
      setCards((prev) => prev.filter((c) => c.place_id !== card.place_id));
      setHistory((h) => [...h.slice(-19), card]);
      const cuisineFilter = filtersRef.current.cuisine;
      pending.current = pending.current.then(() =>
        api("/api/swipe", {
          method: "POST",
          body: JSON.stringify({ placeId: card.place_id, decision, cuisineFilter }),
        }).catch((e) => setError({ message: `Couldn't save swipe: ${e.message}` })),
      );
      if (!exhausted && cards.length - 1 <= REFILL_AT) void loadMore(cards.length - 1);
    },
    [cards.length, exhausted, loadMore],
  );

  const undo = useCallback(async () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    await pending.current;
    const p = api<{ placeId: string | null }>("/api/swipe/undo", { method: "POST" });
    pending.current = p.catch(() => {});
    try {
      await p;
      swipedIds.current.delete(last.place_id);
      setCards((prev) => [last, ...prev.filter((c) => c.place_id !== last.place_id)]);
      setExhausted(false);
    } catch (e) {
      setError({ message: `Undo failed: ${e instanceof Error ? e.message : e}` });
    }
  }, [history]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight") void topRef.current?.fly("yes");
      else if (e.key === "ArrowLeft") void topRef.current?.fly("no");
      else if (e.key === "Backspace" || e.key.toLowerCase() === "z") void undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const top = cards[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar filters={filters} onChange={changeFilters} cuisines={filterData?.cuisines ?? []} tags={filterData?.tags ?? []} />

      {filterData && filterData.untagged > 0 && (
        <p className="mx-4 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {filterData.untagged} restaurants are still being categorized and won&apos;t show under a cuisine yet.
        </p>
      )}

      <div className="relative mx-4 min-h-0 flex-1">
        {cards
          .slice(0, VISIBLE)
          .map((card, i) => (
            <RestaurantCard
              key={card.place_id}
              ref={i === 0 ? topRef : undefined}
              card={card}
              isTop={i === 0}
              depth={i}
              onDecision={(d) => decide(card, d)}
            />
          ))
          .reverse()}

        {!top && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
            {loading ? (
              <p className="text-zinc-500">Finding your next spot…</p>
            ) : error?.code === "no_search" ? (
              <>
                <p className="text-zinc-600 dark:text-zinc-400">No restaurants loaded yet.</p>
                <Link href="/" className="rounded-full bg-zinc-900 px-5 py-2 font-semibold text-white dark:bg-white dark:text-zinc-900">
                  Set your location
                </Link>
              </>
            ) : error ? (
              <>
                <p className="text-rose-600">{error.message}</p>
                <button onClick={retry} className="rounded-full bg-zinc-900 px-5 py-2 font-semibold text-white dark:bg-white dark:text-zinc-900">
                  Try again
                </button>
              </>
            ) : (
              <>
                <p className="text-zinc-600 dark:text-zinc-400">No more matches with these filters.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {!filters.includePassed && (
                    <button
                      onClick={() => changeFilters((f) => ({ ...f, includePassed: true }))}
                      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
                    >
                      Show passed again
                    </button>
                  )}
                  <button
                    onClick={() => changeFilters(EMPTY_FILTERS)}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
                  >
                    Clear filters
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && top && <p className="mx-4 mt-2 text-center text-xs text-rose-600">{error.message}</p>}

      <div className="flex items-center justify-center gap-5 py-4">
        <button
          aria-label="Undo last swipe"
          onClick={undo}
          disabled={history.length === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-amber-500 shadow-md ring-1 ring-black/5 transition active:scale-95 disabled:opacity-30 dark:bg-zinc-900 dark:ring-white/10"
        >
          ↺
        </button>
        <button
          aria-label="No"
          onClick={() => topRef.current?.fly("no")}
          disabled={!top}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-rose-500 shadow-lg ring-1 ring-black/5 transition active:scale-95 disabled:opacity-30 dark:bg-zinc-900 dark:ring-white/10"
        >
          ✕
        </button>
        <button
          aria-label="Yes"
          onClick={() => topRef.current?.fly("yes")}
          disabled={!top}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-emerald-500 shadow-lg ring-1 ring-black/5 transition active:scale-95 disabled:opacity-30 dark:bg-zinc-900 dark:ring-white/10"
        >
          ♥
        </button>
      </div>
      <p className="hidden pb-2 text-center text-xs text-zinc-400 sm:block">← no · → yes · Z undo</p>
    </div>
  );
}
