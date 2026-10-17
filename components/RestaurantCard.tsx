"use client";

import { animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useImperativeHandle, useRef, type Ref } from "react";
import { labelOf, mapsUrl, photoUrl, priceLabel, type Card } from "@/lib/client";
import { ArrowUpRightIcon, PlateIcon } from "./icons";

export type CardHandle = { fly: (decision: "yes" | "no") => Promise<void> };

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

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
  const meta = [card.cuisine && labelOf(card.cuisine), price, `${card.distance_mi.toFixed(1)} mi`].filter(Boolean);

  return (
    <motion.article
      className="absolute inset-0 flex select-none flex-col overflow-hidden rounded-[36px] bg-card shadow-[0_10px_30px_-12px_rgba(14,59,46,0.35)]"
      // pan-y: horizontal drags swipe, vertical ones scroll the card's content.
      style={{ x, rotate, touchAction: isTop ? "pan-y" : "auto", zIndex: 10 - depth }}
      initial={false}
      animate={{ scale: 1 - depth * 0.04, y: depth * 12 }}
      drag={isTop ? "x" : false}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      aria-hidden={!isTop}
    >
      {/* The whole card scrolls when its text doesn't fit; the card itself keeps its size. */}
      <div className="flex h-full flex-col overflow-y-auto overscroll-contain [scrollbar-width:none]">
        <div className="relative h-[46%] shrink-0 bg-peach">
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
            <div className="flex h-full items-center justify-center text-muted/60">
              <PlateIcon className="h-20 w-20" />
            </div>
          )}
          <a
            href={mapsUrl(card)}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-4 top-4 flex min-h-9 items-center gap-1 rounded-full bg-card/95 px-3.5 text-sm font-semibold text-ink"
          >
            Map <ArrowUpRightIcon className="h-3.5 w-3.5" />
          </a>
          {card.rating !== null && (
            <span
              className="absolute -bottom-7 left-5 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-ink leading-none text-card ring-4 ring-card"
              aria-label={`Rated ${card.rating.toFixed(1)} from ${card.rating_count.toLocaleString()} reviews`}
            >
              <span className="text-xl font-extrabold">{card.rating.toFixed(1)}</span>
              <span className="mt-0.5 text-[10px] font-medium">★ {compact.format(card.rating_count)}</span>
            </span>
          )}
          <motion.span
            style={{ opacity: yesOpacity }}
            className="absolute left-5 top-6 -rotate-12 rounded-2xl border-[3px] border-on-coral bg-coral px-4 py-1.5 text-2xl font-extrabold tracking-wide text-on-coral"
          >
            YUM!
          </motion.span>
          <motion.span
            style={{ opacity: noOpacity }}
            className="absolute right-5 top-16 rotate-12 rounded-2xl border-[3px] border-ink bg-card px-4 py-1.5 text-2xl font-extrabold tracking-wide text-ink"
          >
            NAH
          </motion.span>
        </div>

        {/* flex-1 fills the space under the photo, so tags sit at the bottom when the text is short. */}
        <div className={`flex flex-1 flex-col gap-2 px-5 pb-5 ${card.rating !== null ? "pt-9" : "pt-5"}`}>
          <p className="text-sm font-semibold text-muted">
            {meta.join(" · ")}
            {card.rating === null && " · No ratings yet"}
          </p>
          <h2 className="text-[28px] font-extrabold leading-[1.05] tracking-tight">{card.name}</h2>
          {card.reasons.length > 0 && (
            <p className={`rounded-2xl px-3 py-2 text-sm font-medium ${card.explore ? "bg-peach" : "bg-soft"}`}>
              {card.explore ? "Something new: " : "Picked for you: "}
              {card.reasons.join(" · ")}
            </p>
          )}
          {card.summary && <p className="text-sm text-muted">{card.summary}</p>}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {card.tags.map((t) => (
              <span key={t} className="rounded-full bg-peach px-3 py-1 text-[13px] font-semibold">
                {labelOf(t)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
