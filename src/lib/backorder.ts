import { round3 } from "./format";

export interface SplitLine {
  id: string;
  quantity: number;
  /** Most that can be processed now: what is in stock for moves, the ordered quantity for receipts. */
  limit: number;
}

export interface SplitPlanItem {
  id: string;
  /** Stays on the operation and is processed now. */
  keep: number;
  /** Moves to the backorder. */
  rest: number;
  /** The requested quantity is above the limit. */
  overLimit: boolean;
}

/**
 * Splits each line into what is processed now and what moves to a backorder. Without a request
 * for a line, as much as the limit allows is kept.
 */
export function planSplit(lines: SplitLine[], requested: Map<string, number> = new Map()): SplitPlanItem[] {
  return lines.map((line) => {
    const limit = round3(Math.max(0, Math.min(line.quantity, line.limit)));
    const keep = round3(requested.get(line.id) ?? limit);
    return { id: line.id, keep, rest: round3(Math.max(0, line.quantity - keep)), overLimit: keep > limit };
  });
}
