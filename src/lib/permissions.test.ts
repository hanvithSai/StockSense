import { describe, expect, it } from "vitest";
import { actionCapability, can, manageCapability } from "./permissions";

describe("permissions", () => {
  it("gives managers every capability and staff only processing and stock moves", () => {
    expect(can("manager", "users:manage")).toBe(true);
    expect(can("staff", "operation:process")).toBe(true);
    expect(can("staff", "stock:move")).toBe(true);
    expect(can("staff", "operation:plan")).toBe(false);
    expect(can("staff", "master:write")).toBe(false);
    expect(can(null, "operation:process")).toBe(false);
  });

  it("lets planners manage receipts and deliveries, stock movers the rest", () => {
    expect(manageCapability("receipt")).toBe("operation:plan");
    expect(manageCapability("delivery")).toBe("operation:plan");
    expect(manageCapability("internal")).toBe("stock:move");
    expect(manageCapability("adjustment")).toBe("stock:move");
  });

  it("requires the manage capability only to cancel or reset", () => {
    expect(actionCapability("delivery", "validate")).toBe("operation:process");
    expect(actionCapability("delivery", "pick")).toBe("operation:process");
    expect(actionCapability("delivery", "cancel")).toBe("operation:plan");
    expect(actionCapability("internal", "reset")).toBe("stock:move");
  });
});
