import type { Metadata } from "next";
import { TogetherView } from "@/components/TogetherView";

export const metadata: Metadata = { title: "Together · Restaurant Swipe" };

export default function TogetherPage() {
  return (
    <main className="flex-1 overflow-y-auto pb-6">
      <TogetherView />
    </main>
  );
}
