import { describe, it, expect } from "vitest";
import { parseDate, addDays, formatDate } from "./date-utils";

describe("parseDate", () => {
  it("parses a YYYY-MM-DD string into a local date", () => {
    const d = parseDate("2026-07-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it("parses the first day of the year", () => {
    const d = parseDate("2026-01-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const d = parseDate("2026-07-15");
    const result = addDays(d, 1);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(16);
  });

  it("subtracts days with negative offset", () => {
    const d = parseDate("2026-07-15");
    const result = addDays(d, -1);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(14);
  });

  it("crosses month boundaries", () => {
    const d = parseDate("2026-07-31");
    const result = addDays(d, 1);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7); // August
    expect(result.getDate()).toBe(1);
  });

  it("crosses year boundaries", () => {
    const d = parseDate("2026-12-31");
    const result = addDays(d, 1);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it("does not mutate the original date", () => {
    const d = parseDate("2026-07-15");
    addDays(d, 5);
    expect(d.getDate()).toBe(15);
  });
});

describe("formatDate + parseDate round-trip", () => {
  it("round-trips a date through format and parse", () => {
    const original = parseDate("2026-07-15");
    const formatted = formatDate(original);
    const restored = parseDate(formatted);
    expect(restored.getFullYear()).toBe(original.getFullYear());
    expect(restored.getMonth()).toBe(original.getMonth());
    expect(restored.getDate()).toBe(original.getDate());
  });
});
