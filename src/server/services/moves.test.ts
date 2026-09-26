import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import type { OperationType } from "@/lib/constants";
import { toMoveRow } from "./moves";
import type { UnwoundLineLean } from "./records";

function unwound(type: OperationType, line: Partial<UnwoundLineLean["lines"]> = {}): UnwoundLineLean {
  return {
    _id: new Types.ObjectId(),
    reference: "WH/ADJ/0001",
    type,
    status: "done",
    warehouse: new Types.ObjectId(),
    sourceLocation: new Types.ObjectId(),
    destLocation: new Types.ObjectId(),
    sourceName: type === "adjustment" ? "Virtual/Inventory Adjustment" : "WH/Stock",
    destName: type === "adjustment" ? "WH/Stock" : "Partners/Customers",
    contact: "",
    deliveryAddress: "",
    scheduledDate: "2026-09-26",
    responsible: null,
    responsibleName: "",
    notes: "",
    packed: false,
    doneAt: new Date("2026-09-26T10:00:00Z"),
    doneByName: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: {
      _id: new Types.ObjectId(),
      product: new Types.ObjectId(),
      productName: "Steel",
      sku: "STEEL001",
      uom: "kg",
      category: null,
      quantity: 37,
      picked: false,
      systemQty: 40,
      delta: -3,
      ...line,
    },
  };
}

describe("toMoveRow", () => {
  it("marks receipts as incoming and deliveries as outgoing", () => {
    expect(toMoveRow(unwound("receipt")).direction).toBe("in");
    expect(toMoveRow(unwound("delivery")).direction).toBe("out");
    expect(toMoveRow(unwound("internal")).direction).toBe("internal");
  });

  it("logs a negative adjustment as an outgoing move of the difference", () => {
    const row = toMoveRow(unwound("adjustment"));
    expect(row).toMatchObject({ direction: "out", quantity: 3, from: "WH/Stock", to: "Virtual/Inventory Adjustment" });
  });

  it("logs a positive adjustment as an incoming move", () => {
    const row = toMoveRow(unwound("adjustment", { quantity: 45, delta: 5 }));
    expect(row).toMatchObject({ direction: "in", quantity: 5, to: "WH/Stock" });
  });

  it("uses the validation time as the move date", () => {
    expect(toMoveRow(unwound("receipt")).date).toBe("2026-09-26T10:00:00.000Z");
  });
});
