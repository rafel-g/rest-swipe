import type { Metadata } from "next";
import { SwipeDeck } from "@/components/SwipeDeck";

export const metadata: Metadata = { title: "Swipe · Restaurant Swipe" };

export default function SwipePage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col pt-4">
      <SwipeDeck />
    </main>
  );
}
