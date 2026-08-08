"use client";

const PALETTE = [
  "#2F6FED", "#7C3AED", "#DB2777", "#DC2626", "#EA580C",
  "#16A34A", "#0891B2", "#4F46E5",
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function UserAvatar({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: colorFor(name || "?") }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function AiAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-accent text-white shadow-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 4 6v6c0 5 3.6 8.6 8 10 4.4-1.4 8-5 8-10V6l-8-4Z" />
        <path d="M9.5 12.5 11 14l3.5-3.5" />
      </svg>
    </div>
  );
}
