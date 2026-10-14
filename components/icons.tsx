/** Stroke icons shared by the UI. Decorative: pair them with visible text or an aria-label. */

type Props = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const PinIcon = ({ className }: Props) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

export const SlidersIcon = ({ className }: Props) => (
  <svg {...base} strokeWidth={2} className={className}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </svg>
);

export const UndoIcon = ({ className }: Props) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 010 12h-3" />
  </svg>
);

export const XIcon = ({ className }: Props) => (
  <svg {...base} strokeWidth={2.8} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const HeartIcon = ({ className }: Props) => (
  <svg {...base} fill="currentColor" stroke="none" className={className}>
    <path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.6C12 6.1 13.4 5 15.4 5c3.4 0 5.3 3.4 3.8 6.4C19 15.6 12 20 12 20z" />
  </svg>
);

export const ArrowUpRightIcon = ({ className }: Props) => (
  <svg {...base} strokeWidth={2.6} className={className}>
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export const CardsIcon = ({ className }: Props) => (
  <svg {...base} strokeWidth={2} className={className}>
    <rect x="6" y="3" width="12" height="18" rx="2.5" />
    <path d="M3 6v12M21 6v12" />
  </svg>
);

export const BookmarkIcon = ({ className, filled }: Props & { filled?: boolean }) => (
  <svg {...base} strokeWidth={2} fill={filled ? "currentColor" : "none"} className={className}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
);

export const PlateIcon = ({ className }: Props) => (
  <svg {...base} strokeWidth={1.6} className={className}>
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="9.5" />
  </svg>
);
