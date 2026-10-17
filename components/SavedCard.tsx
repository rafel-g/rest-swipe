import type { ReactNode } from "react";
import { ArrowUpRightIcon, PlateIcon } from "./icons";
import { labelOf, mapsUrl, photoUrl, priceLabel } from "@/lib/client";

export type Saved = {
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

/** One tile in a two-column grid of saved places. `badge` sits in the photo's top-right corner. */
export function SavedCard({ r, index, badge }: { r: Saved; index: number; badge?: ReactNode }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-[26px] bg-card">
      <div className={`relative h-28 ${TINTS[index % TINTS.length]}`}>
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
        {badge && <span className="absolute right-2.5 top-2.5">{badge}</span>}
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
  );
}
