import { describe, it, expect } from "vitest";
import { availabilityVisual } from "./availability";

describe("availabilityVisual", () => {
  it("returns 0% and red when no spots are free", () => {
    const { percent, color } = availabilityVisual(0, 10);
    expect(percent).toBe(0);
    expect(color).toBe("hsl(0, 65%, 45%)");
  });

  it("returns 100% and green when all spots are free", () => {
    const { percent, color } = availabilityVisual(10, 10);
    expect(percent).toBe(100);
    expect(color).toBe("hsl(120, 65%, 45%)");
  });

  it("returns 50% and yellow when half the spots are free", () => {
    const { percent, color } = availabilityVisual(5, 10);
    expect(percent).toBe(50);
    expect(color).toBe("hsl(60, 65%, 45%)");
  });

  it("handles zero total spots without dividing by zero", () => {
    const { percent, color } = availabilityVisual(0, 0);
    expect(percent).toBe(0);
    expect(color).toBe("hsl(0, 65%, 45%)");
  });

  it("clamps free counts above the total to 100%", () => {
    const { percent, color } = availabilityVisual(15, 10);
    expect(percent).toBe(100);
    expect(color).toBe("hsl(120, 65%, 45%)");
  });

  it("clamps negative free counts to 0%", () => {
    const { percent } = availabilityVisual(-5, 10);
    expect(percent).toBe(0);
  });
});
