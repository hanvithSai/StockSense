import { describe, expect, it } from "vitest";
import { operationCreateSchema, operationRules, type OperationFields } from "./operations";

const STOCK = "64b000000000000000000001";
const RACK = "64b000000000000000000002";
const DESK = "64b0000000000000000000a1";
const CHAIR = "64b0000000000000000000a2";

function fields(overrides: Partial<OperationFields> = {}): OperationFields {
  return {
    sourceLocation: "",
    destLocation: "",
    contact: "",
    deliveryAddress: "",
    scheduledDate: "2026-09-26",
    responsible: "",
    notes: "",
    lines: [{ product: DESK, quantity: 5 }],
    ...overrides,
  };
}

describe("operationRules", () => {
  it("requires a supplier and a destination for receipts", () => {
    expect(operationRules("receipt", fields())).toEqual({
      contact: "Enter the supplier you receive from",
      destLocation: "Select the destination location",
    });
    expect(operationRules("receipt", fields({ contact: "Azure Interior", destLocation: STOCK }))).toEqual({});
  });

  it("requires a customer and a source for deliveries", () => {
    const errors = operationRules("delivery", fields());
    expect(errors.contact).toBeDefined();
    expect(errors.sourceLocation).toBeDefined();
  });

  it("rejects internal transfers to the same location", () => {
    const errors = operationRules("internal", fields({ sourceLocation: STOCK, destLocation: STOCK }));
    expect(errors.destLocation).toBe("Destination must differ from the source");
    expect(operationRules("internal", fields({ sourceLocation: STOCK, destLocation: RACK }))).toEqual({});
  });

  it("rejects duplicate products and non-positive quantities", () => {
    const errors = operationRules(
      "receipt",
      fields({
        contact: "Vendor",
        destLocation: STOCK,
        lines: [
          { product: DESK, quantity: 0 },
          { product: DESK, quantity: 2 },
        ],
      }),
    );
    expect(errors["lines.0.quantity"]).toBe("Quantity must be greater than 0");
    expect(errors["lines.1.product"]).toBe("This product is already listed");
  });

  it("allows a counted quantity of zero for adjustments", () => {
    const counted = fields({ destLocation: STOCK, lines: [{ product: CHAIR, quantity: 0 }] });
    expect(operationRules("adjustment", counted)).toEqual({});
  });

  it("requires at least one product", () => {
    expect(operationRules("receipt", fields({ contact: "V", destLocation: STOCK, lines: [] })).lines).toBe(
      "Add at least one product",
    );
  });
});

describe("operationCreateSchema", () => {
  it("applies the business rules as field issues", () => {
    const result = operationCreateSchema.safeParse({ ...fields(), type: "receipt" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["contact", "destLocation"]));
  });

  it("rejects quantities with more than three decimals and invalid dates", () => {
    const result = operationCreateSchema.safeParse({
      ...fields({ contact: "V", destLocation: STOCK, scheduledDate: "26-09-2026", lines: [{ product: DESK, quantity: 1.2345 }] }),
      type: "receipt",
    });
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["scheduledDate", "lines.0.quantity"]));
  });
});
