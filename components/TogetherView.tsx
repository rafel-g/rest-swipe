"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "./Avatars";
import { PlusIcon, UsersIcon, XIcon } from "./icons";
import { SavedCard, type Saved } from "./SavedCard";
import { api } from "@/lib/client";
import { addFriend, matchesWith, RELATIONS, removeFriend, useFriends, type Relation } from "@/lib/friends";

export function TogetherView() {
  const friends = useFriends();
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api<{ saved: Saved[] }>("/api/saved")
      .then((r) => setSaved(r.saved))
      .catch((e) => setError(e.message));
  }, []);

  const selected = friends.find((f) => f.id === selectedId) ?? friends[0];
  const matches = selected && saved ? matchesWith(selected, saved) : [];
  const showForm = adding || friends.length === 0;

  return (
    <>
      <header className="flex items-center gap-3 px-4 pb-1 pt-6">
        <h1 className="flex-1 text-[28px] font-extrabold tracking-tight">Together</h1>
        <span className="rounded-full bg-peach px-3 py-1 text-xs font-bold">Preview · sample data</span>
      </header>
      <p className="px-4 pb-3 text-sm font-medium text-muted">Places you and your people both swiped right on.</p>

      {friends.length > 0 && (
        <ul className="flex gap-3 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none]" aria-label="Your people">
          {friends.map((f) => {
            const active = f.id === selected?.id;
            return (
              <li key={f.id} className="shrink-0">
                <button
                  onClick={() => {
                    setSelectedId(f.id);
                    setAdding(false);
                  }}
                  aria-pressed={active}
                  className={`flex min-h-12 items-center gap-2 rounded-full py-1 pl-1 pr-4 text-sm font-semibold transition ${
                    active ? "bg-ink text-card" : "bg-card text-ink hover:bg-soft"
                  }`}
                >
                  <Avatar friend={f} />
                  {f.name}
                </button>
              </li>
            );
          })}
          <li className="shrink-0">
            <button
              onClick={() => setAdding((a) => !a)}
              aria-expanded={adding}
              className="flex min-h-12 items-center gap-1.5 rounded-full border-2 border-dashed border-ink/30 px-4 text-sm font-semibold hover:bg-card"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          </li>
        </ul>
      )}

      {showForm && (
        <AddPerson
          first={friends.length === 0}
          onAdded={(id) => {
            setSelectedId(id);
            setAdding(false);
          }}
          onCancel={friends.length > 0 ? () => setAdding(false) : undefined}
        />
      )}

      {selected && !showForm && (
        <section aria-live="polite">
          <div className="flex items-center gap-2 px-4 pb-3">
            <p className="flex-1 font-bold">
              {saved === null
                ? "Loading…"
                : `You & ${selected.name} both liked ${matches.length} ${matches.length === 1 ? "place" : "places"}`}
            </p>
            <button
              onClick={() => {
                if (confirm(`Remove ${selected.name}?`)) {
                  removeFriend(selected.id);
                  setSelectedId(null);
                }
              }}
              className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-card"
            >
              Remove
            </button>
          </div>

          {error ? (
            <p className="px-4 text-danger">{error}</p>
          ) : saved === null ? null : saved.length === 0 ? (
            <Empty>
              <p className="text-muted">Save a few places first. Then we&apos;ll show which ones {selected.name} liked too.</p>
              <Link href="/swipe" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-semibold text-card">
                Start swiping
              </Link>
            </Empty>
          ) : matches.length === 0 ? (
            <Empty>
              <p className="text-muted">No overlap yet. Keep swiping and matches with {selected.name} will show up here.</p>
            </Empty>
          ) : (
            <ul className="grid grid-cols-2 gap-3 px-4">
              {matches.map((r, i) => (
                <SavedCard key={r.place_id} r={r} index={i} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="mx-4 mt-1 rounded-[28px] bg-card px-6 py-10 text-center">{children}</div>;
}

function AddPerson({
  first,
  onAdded,
  onCancel,
}: {
  first: boolean;
  onAdded: (id: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation>("household");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdded(addFriend(name, relation).id);
  }

  return (
    <form onSubmit={submit} className="mx-4 mb-4 flex flex-col gap-4 rounded-[28px] bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage-2">
          <UsersIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-bold">{first ? "Add your household" : "Add someone"}</h2>
          <p className="text-sm text-muted">
            {first ? "Find places you both love. No more “I don’t know, where do you want to go?”" : "They’ll get an invite to start swiping."}
          </p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Cancel" className="-mr-1 -mt-1 rounded-full p-2 hover:bg-soft">
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sam"
          maxLength={40}
          autoFocus={!first}
          className="min-h-11 rounded-2xl bg-ground px-4 text-base font-medium outline-none ring-ink/40 focus:ring-2"
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-sm font-semibold">They are</legend>
        <div className="flex gap-2">
          {RELATIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRelation(r.value)}
              aria-pressed={relation === r.value}
              className={`min-h-10 flex-1 rounded-full text-sm font-semibold ${
                relation === r.value ? "bg-ink text-card" : "bg-ground text-ink hover:bg-soft"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!name.trim()}
        className="min-h-12 rounded-full bg-ink font-semibold text-card transition active:scale-[0.98] disabled:opacity-40"
      >
        Send invite
      </button>
      <p className="-mt-2 text-center text-xs text-muted">Invites are coming soon. For now you&apos;ll see sample matches.</p>
    </form>
  );
}
