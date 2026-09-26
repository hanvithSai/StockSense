import { describe, expect, it } from "vitest";
import { suggestLevels } from "./reorder";

describe("suggestLevels", () => {
  it("covers one week of demand as minimum and three weeks as maximum", () => {
    expect(suggestLevels(60)).toEqual({ perDay: 2, minQty: 14, maxQty: 42 });
  });

  it("rounds levels up so fractional demand is still covered", () => {
    expect(suggestLevels(10)).toEqual({ perDay: 0.33, minQty: 3, maxQty: 7 });
  });

  it("has no suggestion without deliveries", () => {
    expect(suggestLevels(0)).toBeNull();
    expect(suggestLevels(5, 0)).toBeNull();
  });
});
