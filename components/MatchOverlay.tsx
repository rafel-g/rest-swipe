"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { photoUrl, type Card } from "@/lib/client";
import { namesLabel, type Friend } from "@/lib/friends";
import { Avatar } from "./Avatars";
import { HeartIcon, PlateIcon } from "./icons";

export type Match = { id: number; card: Card; with: Friend[] };

const SHOW_MS = 2400;

/** "It's a match!" celebration over the deck. Dismisses itself, or on tap / Escape. */
export function MatchOverlay({ match, onDone }: { match: Match | null; onDone: () => void }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!match) return;
    const t = setTimeout(onDone, SHOW_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [match, onDone]);

  const pop = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, scale: 0.6 },
          animate: { opacity: 1, scale: 1 },
          transition: { type: "spring" as const, stiffness: 420, damping: 18, delay },
        };

  return (
    <AnimatePresence>
      {match && (
        <motion.div
          key={match.id}
          role="status"
          onClick={onDone}
          className="absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-5 rounded-[36px] bg-ink/90 p-6 text-center text-card backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.p {...pop(0)} className="text-[34px] font-extrabold leading-none tracking-tight text-coral">
            It&apos;s a match!
          </motion.p>

          <div className="relative">
            <motion.div {...pop(0.08)} className="h-36 w-36 overflow-hidden rounded-full bg-peach ring-4 ring-card">
              {match.card.photo_name ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(match.card.photo_name)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted/60">
                  <PlateIcon className="h-14 w-14" />
                </div>
              )}
            </motion.div>
            {/* You on the left, them on the right, a heart where they meet. */}
            <motion.span
              initial={reduce ? false : { x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
              className="absolute -bottom-2 -left-5 flex h-14 w-14 items-center justify-center rounded-full bg-coral text-sm font-extrabold text-on-coral ring-4 ring-ink"
            >
              You
            </motion.span>
            <motion.span
              initial={reduce ? false : { x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
              className="absolute -bottom-2 -right-5 flex -space-x-3"
            >
              {match.with.slice(0, 2).map((f) => (
                <Avatar key={f.id} friend={f} size="lg" className="ring-4 ring-ink" />
              ))}
            </motion.span>
            <motion.span
              initial={reduce ? false : { scale: 0 }}
              animate={reduce ? undefined : { scale: [0, 1.35, 1] }}
              transition={{ duration: 0.45, delay: 0.38 }}
              className="absolute -bottom-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-card text-coral"
            >
              <HeartIcon className="h-6 w-6" />
            </motion.span>
          </div>

          <motion.div {...pop(0.3)} className="mt-4">
            <p className="text-lg font-bold leading-snug">
              You & {namesLabel(match.with)} {match.with.length > 1 ? "all" : "both"} liked{" "}
              <span className="text-coral">{match.card.name}</span>!
            </p>
            <p className="mt-1 text-sm text-card/70">
              Tap anywhere to keep swiping
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
