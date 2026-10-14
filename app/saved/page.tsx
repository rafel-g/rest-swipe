import type { Metadata } from "next";
import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Saved · Restaurant Swipe" };

export default function SavedPage() {
  return (
    <main className="flex-1 overflow-y-auto pb-6">
      <SavedList />
    </main>
  );
}
