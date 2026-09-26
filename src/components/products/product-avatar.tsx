import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "bg-teal-500/12 text-teal-700 dark:text-teal-300",
  "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
];

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(value);
}

/** Initials tile; products of the same category share a colour, which helps scanning long lists. */
export function ProductAvatar({ name, category, className }: { name: string; category?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
        TONES[hash(category ?? name) % TONES.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
