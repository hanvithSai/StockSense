/** Units measured on a continuous scale; every other unit (Units, Box, Pack, Dozen, Pair, Roll) is counted. */
export const DIVISIBLE_UNITS: readonly string[] = ["kg", "g", "L", "mL", "m", "cm"];

const COUNTED_NAMES: Record<string, string> = {
  Units: "units",
  Box: "boxes",
  Pack: "packs",
  Dozen: "dozens",
  Pair: "pairs",
  Roll: "rolls",
};

export function isCountedUnit(uom: string): boolean {
  return !DIVISIBLE_UNITS.includes(uom);
}

/** Message when a quantity of a counted unit is not a whole number (null when the quantity is fine). */
export function wholeUnitError(uom: string | undefined, quantity: number): string | null {
  if (!uom || !isCountedUnit(uom) || !Number.isFinite(quantity) || Number.isInteger(quantity)) return null;
  return `Enter a whole number of ${COUNTED_NAMES[uom] ?? uom.toLowerCase()}`;
}
