import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes and embedded commas", () => {
    expect(parseCsv('name,sku\r\n"Desk, oak",DESK001\n"Say ""hi""",X1')).toEqual([
      ["name", "sku"],
      ["Desk, oak", "DESK001"],
      ['Say "hi"', "X1"],
    ]);
  });

  it("strips the byte order mark and blank lines", () => {
    expect(parseCsv("\ufeffa,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("round-trips with toCsv", () => {
    const rows = [["Line\nbreak", 'Quote "x"', "a,b"]];
    expect(parseCsv(toCsv(["c1", "c2", "c3"], rows))).toEqual([["c1", "c2", "c3"], ["Line\nbreak", 'Quote "x"', "a,b"]]);
  });
});
