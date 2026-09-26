import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { formatQty } from "@/lib/format";
import type { MoveDirection } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<MoveDirection, string> = {
  in: "text-emerald-600 dark:text-emerald-400",
  out: "text-destructive",
  internal: "text-sky-700 dark:text-sky-300",
};

const ICONS = { in: ArrowDownLeft, out: ArrowUpRight, internal: ArrowLeftRight };

/** Quantity coloured by direction: incoming green, outgoing red, internal blue. */
export function MoveQuantity({ direction, quantity, uom }: { direction: MoveDirection; quantity: number; uom?: string }) {
  const Icon = ICONS[direction];
  const sign = direction === "in" ? "+" : direction === "out" ? "−" : "";
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium whitespace-nowrap tabular", STYLES[direction])}>
      <Icon className="size-3.5" />
      {sign}
      {formatQty(quantity)}
      {uom && <span className="text-xs font-normal text-muted-foreground">{uom}</span>}
    </span>
  );
}
