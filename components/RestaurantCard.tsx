"use client";

import { animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useImperativeHandle, useRef, type Ref } from "react";
import { labelOf, mapsUrl, photoUrl, priceLabel, type Card } from "@/lib/client";

export type CardHandle = { fly: (decision: "yes" | "no") => Promise<void> };

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;

export function RestaurantCard({
  card,
  isTop,
  depth,
  onDecision,
  ref,
}: {
  card: Card;
  isTop: boolean;
  depth: number;
  onDecision: (decision: "yes" | "no") => void;
  ref?: Ref<CardHandle>;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const yesOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const noOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);

  const flying = useRef(false);

  async function fly(decision: "yes" | "no") {
    // A double key press or a click during the animation must not count twice.
    if (flying.current) return;
    flying.current = true;
    await animate(x, decision === "yes" ? 600 : -600, { duration: 0.25, ease: "easeIn" });
    onDecision(decision);
  }

  useImperativeHandle(ref, () => ({ fly }));

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) void fly("yes");
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) void fly("no");
    else void animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
  }

  const price = priceLabel(card.price_level);

  return (
    <motion.article
      className="absolute inset-0 flex select-none flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
      style={{ x, rotate, touchAction: isTop ? "none" : "auto", zIndex: 10 - depth }}
      initial={false}
      animate={{ scale: 1 - depth * 0.04, y: depth * 12 }}
      drag={isTop ? "x" : false}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      aria-hidden={!isTop}
    >
      <div className="relative h-[55%] shrink-0 bg-zinc-200 dark:bg-zinc-800">
        {card.photo_name ? (
          // Plain img: the proxy already sizes and caches the photo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl(card.photo_name)}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
            loading={depth === 0 ? "eager" : "lazy"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">🍽️</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        {card.cuisine && (
          <span className="absolute bottom-3 left-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-zinc-900">
            {labelOf(card.cuisine)}
          </span>
        )}
        <motion.span
          style={{ opacity: yesOpacity }}
          className="absolute left-5 top-5 -rotate-12 rounded-lg border-4 border-emerald-500 px-3 py-1 text-3xl font-black tracking-wider text-emerald-500"
        >
          YES
        </motion.span>
        <motion.span
          style={{ opacity: noOpacity }}
          className="absolute right-5 top-5 rotate-12 rounded-lg border-4 border-rose-500 px-3 py-1 text-3xl font-black tracking-wider text-rose-500"
        >
          NOPE
        </motion.span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">{card.name}</h2>
          <a
            href={mapsUrl(card)}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Map ↗
          </a>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {card.rating !== null ? (
            <>
              <span className="font-semibold text-amber-500">★ {card.rating.toFixed(1)}</span>{" "}
              ({card.rating_count.toLocaleString()})
            </>
          ) : (
            "No ratings yet"
          )}
          {price && <> · {price}</>}
          {" · "}
          {card.distance_mi.toFixed(1)} mi
        </p>
        {card.reasons.length > 0 && (
          <p
            className={`text-sm font-medium ${card.explore ? "text-violet-600 dark:text-violet-400" : "text-emerald-700 dark:text-emerald-400"}`}
          >
            {card.explore ? "✨ " : "♥ "}
            {card.reasons.join(" · ")}
          </p>
        )}
        {card.summary && <p className="line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">{card.summary}</p>}
        <div className="mt-auto flex flex-wrap gap-1.5 overflow-hidden">
          {card.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {labelOf(t)}
            </span>
          ))}
        </div>
      </div>
    </motion.article>
  );
}
