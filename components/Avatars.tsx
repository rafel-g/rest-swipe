import { avatarTint, initials, type Friend } from "@/lib/friends";

const SIZES = { sm: "h-6 w-6 text-[10px]", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base" };

export function Avatar({ friend, size = "md", className = "" }: { friend: Friend; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-ink ${SIZES[size]} ${avatarTint(friend)} ${className}`}
    >
      {initials(friend.name)}
    </span>
  );
}

/** Overlapping faces, at most three. */
export function AvatarStack({ friends, size = "sm", label }: { friends: Friend[]; size?: keyof typeof SIZES; label?: string }) {
  return (
    <span className="flex -space-x-1.5" role={label ? "img" : undefined} aria-label={label} title={label}>
      {friends.slice(0, 3).map((f) => (
        <Avatar key={f.id} friend={f} size={size} className="ring-2 ring-card" />
      ))}
    </span>
  );
}
