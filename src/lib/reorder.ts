/** Days of demand used for demand-based reordering levels. */
export const DEMAND_PERIOD_DAYS = 30;
export const MIN_COVER_DAYS = 7;
export const MAX_COVER_DAYS = 21;

export interface DemandSuggestion {
  perDay: number;
  minQty: number;
  maxQty: number;
}

/**
 * Reordering levels from recent demand: the minimum covers one week of deliveries (time to
 * reorder and receive), the maximum three weeks. Returns null without deliveries in the period.
 */
export function suggestLevels(shippedInPeriod: number, periodDays = DEMAND_PERIOD_DAYS): DemandSuggestion | null {
  if (!(shippedInPeriod > 0) || !(periodDays > 0)) return null;
  const perDay = shippedInPeriod / periodDays;
  return {
    perDay: Math.round(perDay * 100) / 100,
    minQty: Math.ceil(perDay * MIN_COVER_DAYS),
    maxQty: Math.ceil(perDay * MAX_COVER_DAYS),
  };
}
