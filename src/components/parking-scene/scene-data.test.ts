import { describe, it, expect } from "vitest";
import {
  BAY_LABELS,
  BAY_LAYOUT,
  SCENE_H,
  SCENE_W,
  CAR_COLOR_PRESETS,
  MINE_HUE,
  bayBox,
  carPaintFor,
  hexToHsl,
  paintFromColor,
  paintFromHue,
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

describe("hexToHsl", () => {
  it("converts primaries and greys", () => {
    expect(hexToHsl("#ff0000")).toEqual({
      hue: 0,
      saturation: 100,
      lightness: 50,
    });
    expect(hexToHsl("#0000FF")).toEqual({
      hue: 240,
      saturation: 100,
      lightness: 50,
    });
    expect(hexToHsl("#808080")?.saturation).toBe(0);
    expect(hexToHsl("#000000")).toEqual({
      hue: 0,
      saturation: 0,
      lightness: 0,
    });
  });

  it("rejects anything that is not #rrggbb", () => {
    expect(hexToHsl("red")).toBeNull();
    expect(hexToHsl("#fff")).toBeNull();
    expect(hexToHsl("#gg0000")).toBeNull();
  });
});

describe("paintFromColor", () => {
  it("leaves the art's shading alone for a mid-lightness colour", () => {
    expect(paintFromColor("#ff8000")).toEqual({
      "--car-hue": "30.1",
      // Full saturation, scaled up from the side art's body paint
      "--car-sat": "1.107",
      "--car-light": "50.0%",
      "--car-contrast": "1.000",
    });
  });

  it("desaturates and squeezes the shading for black and white", () => {
    const black = paintFromColor("#1e1e20");
    expect(Number(black?.["--car-sat"])).toBeLessThan(0.05);
    expect(Number(black?.["--car-contrast"])).toBeLessThan(0.5);

    const white = paintFromColor("#f2f2f2");
    expect(white?.["--car-sat"]).toBe("0.000");
    expect(parseFloat(white?.["--car-light"] ?? "")).toBeGreaterThan(90);
    expect(Number(white?.["--car-contrast"])).toBeLessThan(0.5);
  });

  it("paints the body at the picked colour's own saturation", () => {
    // Blue is ~72% saturated; the side art's body is drawn at 90.3%
    const sat = Number(paintFromColor("#1f5fbf")?.["--car-sat"]);
    expect(90.3 * sat).toBeCloseTo(72.1, 0);
  });

  it("returns null for an invalid colour", () => {
    expect(paintFromColor("")).toBeNull();
  });
});

describe("carPaintFor", () => {
  it("uses the occupant's picked colour, even for your own car", () => {
    expect(carPaintFor("Jana", true, "#d0312d")).toEqual(
      paintFromColor("#d0312d"),
    );
  });

  it("falls back to blue for your car and a name hue for others", () => {
    expect(carPaintFor("Jana", true)).toEqual(paintFromHue(MINE_HUE));
    expect(carPaintFor("Jana", false)).toEqual(
      paintFromHue(hueFromName("Jana")),
    );
  });

  it("ignores a malformed stored colour", () => {
    expect(carPaintFor("Jana", false, "nope")).toEqual(
      paintFromHue(hueFromName("Jana")),
    );
  });
});

describe("CAR_COLOR_PRESETS", () => {
  it("are unique, lower-case #rrggbb as the reducer stores them", () => {
    const colors = CAR_COLOR_PRESETS.map((p) => p.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
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
