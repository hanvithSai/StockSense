import { describe, expect, it } from "vitest";
import { parseProductSort, serializeProductSort, sortProducts } from "./product-sort";
import type { ProductRowDTO } from "./types";

const row = (name: string, onHand: number, value: number) => ({ name, onHand, value }) as ProductRowDTO;
const rows = [row("Desk", 5, 500), row("Bolt", 40, 80), row("Chair", 5, 900)];

describe("product sorting", () => {
  it("sorts by name or by a numeric column in either direction", () => {
    expect(sortProducts(rows, { key: "name", direction: "asc" }).map((r) => r.name)).toEqual(["Bolt", "Chair", "Desk"]);
    expect(sortProducts(rows, { key: "value", direction: "desc" }).map((r) => r.name)).toEqual(["Chair", "Desk", "Bolt"]);
  });

  it("breaks ties by name and never mutates the input", () => {
    expect(sortProducts(rows, { key: "onHand", direction: "asc" }).map((r) => r.name)).toEqual(["Chair", "Desk", "Bolt"]);
    expect(rows.map((r) => r.name)).toEqual(["Desk", "Bolt", "Chair"]);
  });

  it("round-trips through the query string and ignores unknown keys", () => {
    expect(parseProductSort(serializeProductSort({ key: "onHand", direction: "desc" }))).toEqual({ key: "onHand", direction: "desc" });
    expect(parseProductSort("price")).toEqual({ key: "name", direction: "asc" });
    expect(parseProductSort(null)).toEqual({ key: "name", direction: "asc" });
  });
});
