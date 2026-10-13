import type { Metadata } from "next";
import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Saved · Restaurant Swipe" };

export default function SavedPage() {
  return (
    <main className="flex-1 overflow-y-auto pb-6">
      <h1 className="px-4 pb-4 pt-8 text-2xl font-black tracking-tight">Saved</h1>
      <SavedList />
    </main>
  );
}
