import { describe, it, expect } from "vitest";
import {
  BAY_LABELS,
  BAY_LAYOUT,
  SCENE_H,
  SCENE_W,
  bayBox,
  parseSpotName,
  hueFromName,
  initialsOf,
  shortNameOf,
} from "./scene-data";

describe("parseSpotName", () => {
  it("parses floor and bay, dropping leading zeros", () => {
    expect(parseSpotName("-1/070")).toEqual({
      floor: "-1",
      bay: 70,
      accessible: false,
    });
  });

  it("parses a lower floor", () => {
    expect(parseSpotName("-2/086")).toEqual({
      floor: "-2",
      bay: 86,
      accessible: false,
    });
  });

  it("flags accessibility and ignores the trailing emoji", () => {
    expect(parseSpotName("-1/063 ♿️")).toEqual({
      floor: "-1",
      bay: 63,
      accessible: true,
    });
  });

  it("returns NaN bay for names without a floor separator", () => {
    const parsed = parseSpotName("A1");
    expect(parsed.floor).toBe("");
    expect(Number.isNaN(parsed.bay)).toBe(true);
  });

  it("every parsed sample bay has a layout entry", () => {
    for (const name of ["-1/071", "-1/062", "-2/088"]) {
      expect(BAY_LAYOUT[parseSpotName(name).bay]).toBeDefined();
    }
  });
});

describe("hueFromName", () => {
  it("is deterministic and within 0-359", () => {
    const a = hueFromName("Petra Nováková");
    const b = hueFromName("Petra Nováková");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(hueFromName("  Tomáš Dvořák ")).toBe(hueFromName("tomáš dvořák"));
  });

  it("gives different people (usually) different hues", () => {
    expect(hueFromName("Jana Svobodová")).not.toBe(hueFromName("Martin Černý"));
  });
});

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Jakub Veselý")).toBe("JV");
  });

  it("handles a single word", () => {
    expect(initialsOf("Cher")).toBe("C");
  });
});

describe("shortNameOf", () => {
  it("shortens to first name + last initial", () => {
    expect(shortNameOf("Jakub Veselý")).toBe("Jakub V.");
  });

  it("keeps a single word as-is", () => {
    expect(shortNameOf("Cher")).toBe("Cher");
  });
});

describe("bayBox", () => {
  it("anchors the box bottom on the ground line", () => {
    const layout = BAY_LAYOUT[66];
    const box = bayBox(layout);
    const top = parseFloat(box.top);
    const height = parseFloat(box.height);
    // bottom of the box (top + height) sits on the ground line
    expect(top + height).toBeCloseTo(layout.ground, 5);
    // left is centred on cx
    expect(parseFloat(box.left)).toBeCloseTo(layout.cx - layout.w / 2, 5);
    expect(parseFloat(box.width)).toBeCloseTo(layout.w, 5);
  });
});

describe("BAY_LABELS", () => {
  it("draws one number per bay the art has a slot for", () => {
    const labelled = BAY_LABELS.map((l) => l.bay).sort((a, b) => a - b);
    const laidOut = Object.keys(BAY_LAYOUT)
      .map(Number)
      .sort((a, b) => a - b);
    expect(labelled).toEqual(laidOut);
  });

  it("places every label inside the scene", () => {
    for (const l of BAY_LABELS) {
      expect(l.x).toBeGreaterThan(0);
      expect(l.x).toBeLessThan(SCENE_W);
      expect(l.y).toBeGreaterThan(0);
      expect(l.y).toBeLessThan(SCENE_H);
      expect(l.fontSize).toBeGreaterThan(0);
      expect(l.fill).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps each number clear of the car parked in that bay", () => {
    for (const l of BAY_LABELS) {
      // The number is on the wall behind, so its baseline must sit above the
      // top of the car's box; otherwise the car would cover it.
      const baseline = (l.y / SCENE_H) * 100;
      expect(baseline).toBeLessThan(parseFloat(bayBox(BAY_LAYOUT[l.bay]).top));
    }
  });
});
