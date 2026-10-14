import { SetupForm } from "@/components/SetupForm";

export default function Home() {
  return (
    <main className="flex-1 overflow-y-auto pb-6">
      <header className="px-4 pb-4 pt-8">
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">Restaurant Swipe</h1>
        <p className="mt-1 font-medium text-muted">Pick an area, then swipe. It learns what you like.</p>
      </header>
      <SetupForm />
    </main>
  );
}
