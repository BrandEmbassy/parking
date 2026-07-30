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
}

/**
 * Bay geometry, transcribed from the design prototype's SPOTS array.
 * Keyed by bay number (floor -1: 62-71, floor -2: 86-88). The two floors are
 * both drawn in the single background image, so `ground` already places each bay
 * on the correct floor.
 */
export const BAY_LAYOUT: Record<number, BayLayout> = {
  71: { cx: 3.4, w: 10.0, ground: 42.2, side: true, flip: true },
  70: { cx: 10.4, w: 10.0, ground: 42.5, side: true, flip: true },
  67: { cx: 27.3, w: 10.2, ground: 42.9, side: true, flip: true },
  66: { cx: 42.4, w: 10.2, ground: 43.1, side: false, flip: false },
  65: { cx: 54.7, w: 10.2, ground: 43.1, side: false, flip: false },
  64: { cx: 66.7, w: 10.2, ground: 42.9, side: true, flip: false },
  63: { cx: 84.0, w: 10.0, ground: 42.5, side: true, flip: false },
  62: { cx: 96.2, w: 10.0, ground: 42.2, side: true, flip: true },
  86: { cx: 34.8, w: 10.4, ground: 90.5, side: true, flip: true },
  87: { cx: 49.6, w: 10.4, ground: 90.8, side: false, flip: false },
  88: { cx: 64.2, w: 10.4, ground: 90.5, side: true, flip: false },
};

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
