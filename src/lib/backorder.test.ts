import { describe, expect, it } from "vitest";
import { planSplit } from "./backorder";

describe("planSplit", () => {
  it("ships what is in stock and backorders the rest by default", () => {
    const plan = planSplit([
      { id: "desk", quantity: 30, limit: 7 },
      { id: "chair", quantity: 30, limit: 0 },
      { id: "lamp", quantity: 5, limit: 12 },
    ]);
    expect(plan).toEqual([
      { id: "desk", keep: 7, rest: 23, overLimit: false },
      { id: "chair", keep: 0, rest: 30, overLimit: false },
      { id: "lamp", keep: 5, rest: 0, overLimit: false },
    ]);
  });

  it("keeps requested quantities and flags requests above the limit", () => {
    const plan = planSplit(
      [
        { id: "monitor", quantity: 15, limit: 15 },
        { id: "dock", quantity: 10, limit: 10 },
      ],
      new Map([
        ["monitor", 12],
        ["dock", 11],
      ]),
    );
    expect(plan[0]).toEqual({ id: "monitor", keep: 12, rest: 3, overLimit: false });
    expect(plan[1].overLimit).toBe(true);
  });

  it("rounds fractional quantities to three decimals", () => {
    const [steel] = planSplit([{ id: "steel", quantity: 10.1, limit: 10.1 }], new Map([["steel", 3.3333]]));
    expect(steel).toEqual({ id: "steel", keep: 3.333, rest: 6.767, overLimit: false });
  });
});
