/** One stroke family for every glyph: 1.6px, round caps, 16px box. */
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PendingIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" />
  </svg>
);

export const DoneIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.5 8.2l1.7 1.7 3.3-3.6" />
  </svg>
);

export const FailedIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" />
    <path d="M6 6l4 4M10 6l-4 4" />
  </svg>
);

export const RunningIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" opacity="0.3" />
    <path className="spin" d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" />
  </svg>
);

export const SunIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="8" cy="8" r="2.8" />
    <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
  </svg>
);

export const MoonIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6z" />
  </svg>
);
