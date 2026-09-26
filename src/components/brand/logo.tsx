import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id="stocksense-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5a7f" />
          <stop offset="1" stopColor="#5b3a53" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#stocksense-mark)" />
      <path
        d="M16 7.5 24 12v8l-8 4.5L8 20v-8l8-4.5Z M8 12l8 4.5 8-4.5 M16 16.5v8"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">
        Stock<span className="text-primary">Sense</span>
      </span>
    </span>
  );
}
