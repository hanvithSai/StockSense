import { describe, expect, it } from "vitest";
import { isCountedUnit, wholeUnitError } from "./units";

describe("units of measure", () => {
  it("counts pieces, boxes and pairs but measures weight, volume and length", () => {
    expect(["Units", "Box", "Pack", "Dozen", "Pair", "Roll"].every(isCountedUnit)).toBe(true);
    expect(["kg", "g", "L", "mL", "m", "cm"].some(isCountedUnit)).toBe(false);
  });

  it("rejects fractions of counted units only", () => {
    expect(wholeUnitError("Units", 2.5)).toBe("Enter a whole number of units");
    expect(wholeUnitError("Box", 0.3)).toBe("Enter a whole number of boxes");
    expect(wholeUnitError("Units", 3)).toBeNull();
    expect(wholeUnitError("kg", 2.75)).toBeNull();
    expect(wholeUnitError(undefined, 2.5)).toBeNull();
  });
});
