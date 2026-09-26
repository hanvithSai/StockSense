import { describe, expect, it } from "vitest";
import { transitionActions } from "./operation-transitions";

describe("transitionActions", () => {
  it("confirms drafts when dropped on Ready or Waiting", () => {
    expect(transitionActions("receipt", "draft", "ready")).toEqual(["confirm"]);
    expect(transitionActions("delivery", "draft", "waiting")).toEqual(["confirm"]);
  });

  it("runs pick, pack and validate for deliveries dropped on Done", () => {
    expect(transitionActions("delivery", "ready", "done")).toEqual(["pick", "pack", "validate"]);
    expect(transitionActions("delivery", "draft", "done")).toEqual(["confirm", "pick", "pack", "validate"]);
    expect(transitionActions("receipt", "ready", "done")).toEqual(["validate"]);
  });

  it("checks availability when a waiting operation moves to Ready", () => {
    expect(transitionActions("internal", "waiting", "ready")).toEqual(["check-availability"]);
  });

  it("cancels and resets", () => {
    expect(transitionActions("delivery", "ready", "cancelled")).toEqual(["cancel"]);
    expect(transitionActions("delivery", "cancelled", "draft")).toEqual(["reset"]);
  });

  it("never moves done operations and rejects impossible moves", () => {
    expect(transitionActions("receipt", "done", "draft")).toBeNull();
    expect(transitionActions("receipt", "ready", "waiting")).toBeNull();
    expect(transitionActions("adjustment", "draft", "ready")).toBeNull();
    expect(transitionActions("delivery", "cancelled", "done")).toBeNull();
  });
});
