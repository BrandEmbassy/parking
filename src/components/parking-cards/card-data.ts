/**
 * Pure data + helpers for the mobile card rendering of the garage scene.
 *
 * On narrow viewports the wide garage illustration is unusable, so the scene
 * reflows into a fluid grid of spot cards. Each card paints the SAME artwork
 * (public/parking-bg.jpg) cropped to that bay's real horizontal position, so the
 * surroundings a user recognises (dinosaur column, elevators, giraffe column)
 * still appear behind the right spot.
 *
 * Everything here is a pure function of its input so server and client render
 * identically (no hydration mismatch) and the helpers are trivially unit-testable.
 */

import type { SpotData } from "~/services/types";
import { BAY_LAYOUT, parseSpotName } from "../parking-scene/scene-data";

/**
 * Horizontal pan of the artwork behind each bay's card, as a CSS
 * background-position percentage (0 = left edge of the artwork, 100 = right).
 * Because the scaled artwork is wider than the card, a percentage pans it, which
 * keeps the crop correct at every card width without JS. Values are hand-tuned
 * from the design prototype so each card shows its bay's true neighbours.
 */
export const CARD_PAN: Record<number, number> = {
  71: 16,
  70: 27,
  67: 38,
  66: 47,
  65: 56,
  64: 68,
  63: 82,
  62: 100,
  86: 30,
  88: 50,
  89: 68,
};

/**
 * Per-floor crop band. `size` is the source artwork (1586×672) scaled so that
 * floor's band is exactly as tall as the 200px card; the negative `y` offset on
 * the lower floor scrolls the viewport down to its band.
 */
export const FLOOR_BAND: Record<string, { size: string; y: string }> = {
  "-1": { size: "906px 384px", y: "0px" },
  "-2": { size: "1001px 424px", y: "-224px" },
};

export interface CardCrop {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
}

/**
 * CSS crop of the garage artwork for a bay's card, or null when the art has no
 * band/pan for it (the card then keeps its plain fallback background).
 */
export function cardCrop(floor: string, bay: number): CardCrop | null {
  const band = FLOOR_BAND[floor];
  const pan = CARD_PAN[bay];
  if (!band || pan === undefined) {
    return null;
  }
  return {
    backgroundImage: 'url("/parking-bg.jpg")',
    backgroundSize: band.size,
    backgroundPosition: `${pan}% ${band.y}`,
  };
}

export interface FloorGroup {
  /** Floor label as encoded in spot names, e.g. "-1" ("" = unknown floor). */
  floor: string;
  spots: SpotData[];
}

/**
 * Group spots into floors, mirroring the scene: floors top to bottom (-1 before
 * -2), spots left to right as they appear in the artwork. Spots the art knows
 * nothing about go last — after the known bays of their floor, or into a
 * trailing unknown-floor group — so no bookable spot is ever hidden.
 */
export function groupSpotsByFloor(spots: SpotData[]): FloorGroup[] {
  const groups = new Map<string, SpotData[]>();
  for (const spot of spots) {
    const { floor } = parseSpotName(spot.name);
    const group = groups.get(floor);
    if (group) {
      group.push(spot);
    } else {
      groups.set(floor, [spot]);
    }
  }

  const floorOrder = (floor: string): number =>
    floor === "" ? -Infinity : Number(floor);

  return [...groups.entries()]
    .sort(([a], [b]) => floorOrder(b) - floorOrder(a))
    .map(([floor, floorSpots]) => ({
      floor,
      spots: floorSpots.slice().sort((a, b) => {
        const layoutA = BAY_LAYOUT[parseSpotName(a.name).bay];
        const layoutB = BAY_LAYOUT[parseSpotName(b.name).bay];
        if (layoutA && layoutB) {
          return layoutA.cx - layoutB.cx;
        }
        if (layoutA !== layoutB) {
          return layoutA ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      }),
    }));
}

/**
 * Floor heading. The Czech "PODLAŽÍ" is kept on purpose — it mirrors the floor
 * labels painted in the garage artwork the cards crop.
 */
export function floorLabel(floor: string): string {
  return floor === "" ? "OTHER SPOTS" : `PODLAŽÍ ${floor}`;
}

/** Per-floor availability meta, e.g. "3 of 8 free". */
export function freeMeta(spots: SpotData[]): string {
  const free = spots.filter((s) => !s.occupant).length;
  return `${free} of ${spots.length} free`;
}

/**
 * Accessible description of a card. The card conveys state visually through the
 * dashed zone / car / badge; this carries the same information textually.
 */
export function cardAriaLabel(spot: SpotData, isMine: boolean): string {
  const { floor, bay, accessible } = parseSpotName(spot.name);
  const num = Number.isNaN(bay) ? spot.name : String(bay);
  const where = floor ? `, floor ${floor}` : "";
  const marker = accessible ? " (accessible)" : "";
  const subject = `Spot ${num}${marker}${where}`;

  if (isMine) {
    return `${subject}, yours — tap to leave`;
  }
  if (spot.occupant) {
    return `${subject}, taken by ${spot.occupant}`;
  }
  return `${subject}, free — tap to park`;
}
