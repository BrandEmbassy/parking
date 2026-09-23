/**
 * Pure data + helpers for the parking garage scene.
 *
 * The scene is a fixed cartoon illustration of the NiCE garage (public/parking-bg.png)
 * with two floors. Each bay has a fixed position in the art, so the geometry lives in
 * a static map keyed by bay number. Spot names in the database are "<floor>/<bay>"
 * (e.g. "-1/070", "-1/063 ♿️", "-2/086"); we parse the bay number to look up its box.
 *
 * Everything here is a pure function of its input so server and client render
 * identically (no hydration mismatch) and the helpers are trivially unit-testable.
 */

import carFrontRaw from "./car_front.svg?raw";
import carSideRaw from "./car_side.svg?raw";

/** Intrinsic size of the background art; the coordinate map is relative to this. */
export const SCENE_W = 1584;
export const SCENE_H = 672;

/** viewBox of each car SVG (from the source files). */
export const FRONT_VB = "352 191 861 662";
export const SIDE_VB = "425 191 855 597";

/** Car aspect ratio used to derive a bay box height from its width. */
export const RATIO = 662 / 861;

/** Fixed hue (blue) for the signed-in user's own car, so it stands out. */
export const MINE_HUE = 210;

/**
 * Cap height of a digit as a fraction of font-size. Arial, Helvetica, Roboto and
 * Segoe UI (the app's font stack) all sit within a hair of this, so deriving the
 * font size from the measured glyph height lands the same size in any of them.
 */
const DIGIT_CAP_RATIO = 0.71;

/** Measured cap heights of the painted numbers, in scene user units, per floor. */
const CAP_H_UPPER = 56;
const CAP_H_LOWER = 52;

export interface BayLabelArt {
  /** Glyph centre, in scene user units. */
  x: number;
  /** Text baseline, in scene user units. */
  y: number;
  /** Cap height of the digits, in scene user units. */
  capH: number;
  /** Fill colour, sampled from the painted numbers in the original art. */
  fill: string;
}

export interface BayLayout {
  /** Horizontal centre, % of scene width. */
  cx: number;
  /** Bay width, % of scene width. */
  w: number;
  /** Baseline (bottom of the car) as % of scene height. */
  ground: number;
  /** Render the side-view car instead of the front-view car. */
  side: boolean;
  /** Mirror the side car horizontally (points the other way). */
  flip: boolean;
  /**
   * Where this bay's number is painted on the back wall. `label.x` is deliberately
   * not derived from `cx`: the car stands on the floor in perspective while the
   * number is on the wall behind it, so the two centres differ by a few percent.
   */
  label: BayLabelArt;
}

/**
 * Bay geometry, transcribed from the design prototype's SPOTS array, plus the
 * geometry of the number painted on the wall behind each bay.
 *
 * Keyed by bay number, which is also the number rendered on the wall, so this map
 * is the single source of truth for which bays the scene knows about. The two
 * floors are both drawn in the single background image, so `ground` already places
 * each bay on the correct floor.
 */
export const BAY_LAYOUT: Record<number, BayLayout> = {
  71: {
    cx: 3.4,
    w: 10.0,
    ground: 42.2,
    side: true,
    flip: true,
    label: { x: 78.6, y: 146, capH: CAP_H_UPPER, fill: "#b795bb" },
  },
  70: {
    cx: 10.4,
    w: 10.0,
    ground: 42.5,
    side: true,
    flip: true,
    label: { x: 230.5, y: 147, capH: CAP_H_UPPER, fill: "#8dba4e" },
  },
  67: {
    cx: 27.3,
    w: 10.2,
    ground: 42.9,
    side: true,
    flip: true,
    label: { x: 428.0, y: 146, capH: CAP_H_UPPER, fill: "#dc604f" },
  },
  66: {
    cx: 42.4,
    w: 10.2,
    ground: 43.1,
    side: false,
    flip: false,
    label: { x: 670.5, y: 147, capH: CAP_H_UPPER, fill: "#4599bf" },
  },
  65: {
    cx: 54.7,
    w: 10.2,
    ground: 43.1,
    side: false,
    flip: false,
    label: { x: 863.4, y: 147, capH: CAP_H_UPPER, fill: "#8ebb4e" },
  },
  64: {
    cx: 66.7,
    w: 10.2,
    ground: 42.9,
    side: true,
    flip: false,
    label: { x: 1056.0, y: 146, capH: CAP_H_UPPER, fill: "#f4bf30" },
  },
  63: {
    cx: 84.0,
    w: 10.0,
    ground: 42.5,
    side: true,
    flip: false,
    label: { x: 1289.1, y: 146, capH: CAP_H_UPPER, fill: "#d95f4e" },
  },
  62: {
    cx: 96.2,
    w: 10.0,
    ground: 42.2,
    side: true,
    flip: true,
    label: { x: 1503.0, y: 146, capH: CAP_H_UPPER, fill: "#71bab0" },
  },
  86: {
    cx: 34.8,
    w: 10.4,
    ground: 90.5,
    side: true,
    flip: true,
    label: { x: 549.9, y: 464, capH: CAP_H_LOWER, fill: "#f3be2f" },
  },
  88: {
    cx: 49.6,
    w: 10.4,
    ground: 90.8,
    side: false,
    flip: false,
    label: { x: 779.5, y: 469, capH: CAP_H_LOWER, fill: "#8dba4f" },
  },
  89: {
    cx: 64.2,
    w: 10.4,
    ground: 90.5,
    side: true,
    flip: false,
    label: { x: 1008.5, y: 464, capH: CAP_H_LOWER, fill: "#e77335" },
  },
};

export interface BayLabel {
  /** Bay number — also the text that gets drawn. */
  bay: number;
  /** Glyph centre, in scene user units. */
  x: number;
  /** Text baseline, in scene user units. */
  y: number;
  /** Font size, in scene user units. */
  fontSize: number;
  /** Fill colour, sampled from the painted numbers in the original art. */
  fill: string;
}

/**
 * The bay numbers painted on the garage's back wall.
 *
 * The original background art (parking-bg.png) had them baked in; the current art
 * (parking-bg.jpg) is the same illustration with them removed, so the app draws
 * them instead. Position, size and colour were measured off the old art by diffing
 * the two images — they are irregular because the illustration is in perspective,
 * so no two bays share a centre and the lower floor's numbers are a little smaller.
 *
 * The *text* comes from the BAY_LAYOUT keys rather than a list of its own, so a bay
 * that gets renumbered is relabelled automatically and the two can never disagree.
 */
export const BAY_LABELS: BayLabel[] = Object.entries(BAY_LAYOUT).map(
  ([bay, layout]) => ({
    bay: Number(bay),
    x: layout.label.x,
    y: layout.label.y,
    fontSize: layout.label.capH / DIGIT_CAP_RATIO,
    fill: layout.label.fill,
  }),
);

export interface BayBox {
  left: string;
  width: string;
  top: string;
  height: string;
}

/**
 * Absolute-position box (as CSS %) for a bay, given its layout.
 * Height is derived from the width so the car keeps its aspect ratio, and the box
 * is anchored so its bottom sits on `ground`.
 */
export function bayBox(layout: BayLayout): BayBox {
  const boxH = (((layout.w / 100) * SCENE_W * RATIO) / SCENE_H) * 100;
  return {
    left: layout.cx - layout.w / 2 + "%",
    width: layout.w + "%",
    top: layout.ground - boxH + "%",
    height: boxH + "%",
  };
}

export interface ParsedSpotName {
  /** Floor label, e.g. "-1" (empty string if the name has no "/" separator). */
  floor: string;
  /** Bay number, or NaN if it could not be parsed. */
  bay: number;
  /** Whether the name carries an accessibility marker (♿). */
  accessible: boolean;
}

/**
 * Parse a database spot name ("<floor>/<bay>", optionally with a ♿ marker) into
 * its floor, bay number, and accessibility flag.
 *
 *   "-1/070"     -> { floor: "-1", bay: 70,  accessible: false }
 *   "-1/063 ♿️" -> { floor: "-1", bay: 63,  accessible: true  }
 *   "A1"         -> { floor: "",   bay: NaN, accessible: false }
 */
export function parseSpotName(name: string): ParsedSpotName {
  const accessible = /♿/.test(name);
  const slash = name.indexOf("/");
  if (slash === -1) {
    return { floor: "", bay: NaN, accessible };
  }
  const floor = name.slice(0, slash).trim();
  // parseInt reads the leading digits of the bay part and ignores a trailing
  // emoji / whitespace, and drops leading zeros ("070" -> 70).
  const bay = parseInt(name.slice(slash + 1).trim(), 10);
  return { floor, bay, accessible };
}

/**
 * Deterministic hue (0-359) for a name, so each person's car keeps a stable colour
 * across renders, reloads, SSR and clients. Case/whitespace-insensitive.
 */
export function hueFromName(name: string): number {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) {
    h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  }
  return h % 360;
}

/** Up to two uppercase initials from the first and (if present) second word. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Short display name: "First L." when there are ≥2 words, else the single word. */
export function shortNameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? parts[0] + " " + parts[parts.length - 1][0] + "."
    : parts[0];
}

/** Strip the XML prolog, outer <svg> tag, <desc> and closing </svg> from a raw SVG. */
function svgInner(raw: string): string {
  return raw
    .replace(/^\s*<\?xml[^>]*\?>\s*/i, "")
    .replace(/^\s*<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .replace(/<desc>[\s\S]*?<\/desc>/i, "")
    .trim();
}

/**
 * Both car SVGs, inlined once as reusable <defs> symbols referenced by <use>.
 * Built from the raw imports at module load (a pure transform of build-time
 * constants), so it is identical on server and client.
 */
export const CAR_DEFS_HTML =
  '<defs><g id="carFront">' +
  svgInner(carFrontRaw) +
  '</g><g id="carSide">' +
  svgInner(carSideRaw) +
  "</g></defs>";
