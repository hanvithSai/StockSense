import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { stockStatus } from "./stock";

const main = new Types.ObjectId();
const depot = new Types.ObjectId();

describe("stockStatus", () => {
  it("is out of stock when nothing is on hand", () => {
    expect(stockStatus(0, [], new Map())).toBe("out");
  });

  it("is ok without reordering rules while stock exists", () => {
    expect(stockStatus(3, [], new Map([[main.toString(), 3]]))).toBe("ok");
  });

  it("is low when a warehouse is at or below its minimum", () => {
    const onHand = new Map([
      [main.toString(), 10],
      [depot.toString(), 200],
    ]);
    expect(stockStatus(210, [{ warehouse: main, minQty: 10 }], onHand)).toBe("low");
    expect(stockStatus(210, [{ warehouse: main, minQty: 9 }], onHand)).toBe("ok");
  });

  it("treats a warehouse without stock as low for its rule", () => {
    expect(stockStatus(80, [{ warehouse: main, minQty: 20 }], new Map([[depot.toString(), 80]]))).toBe("low");
  });
});
