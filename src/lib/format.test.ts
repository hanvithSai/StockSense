import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { escapeRegex, formatDate, initials, round3, todayISO } from "./format";

describe("round3", () => {
  it("removes floating point drift", () => {
    expect(round3(0.1 + 0.2)).toBe(0.3);
    expect(round3(100 - 20 - 3)).toBe(77);
    expect(round3(1.23456)).toBe(1.235);
  });
});

describe("dates", () => {
  it("formats calendar dates without timezone shifts", () => {
    expect(formatDate("2026-09-26")).toBe("26 Sep 2026");
    expect(formatDate(null)).toBe("—");
  });

  it("returns the local calendar date", () => {
    expect(todayISO(new Date(2026, 8, 26, 23, 30))).toBe("2026-09-26");
  });
});

describe("helpers", () => {
  it("escapes regex metacharacters for safe searches", () => {
    expect(new RegExp(escapeRegex("WH/IN/(1)")).test("WH/IN/(1)")).toBe(true);
  });

  it("builds initials", () => {
    expect(initials("Aarav Mehta")).toBe("AM");
  });

  it("escapes CSV cells", () => {
    expect(toCsv(["Name", "Note"], [['Desk "Pro"', "a,b"]])).toBe('Name,Note\r\n"Desk ""Pro""","a,b"');
  });
});
