import { describe, it, expect } from "vitest";
import { BAY_LAYOUT } from "../parking-scene/scene-data";
import type { SpotData } from "~/services/types";
import {
  CARD_PAN,
  cardCrop,
  cardAriaLabel,
  floorLabel,
  freeMeta,
  groupSpotsByFloor,
} from "./card-data";

const spot = (spotId: number, name: string, occupant = ""): SpotData => ({
  spotId,
  name,
  occupant,
});

describe("CARD_PAN", () => {
  it("covers exactly the bays the scene layout knows about", () => {
    expect(Object.keys(CARD_PAN).sort()).toEqual(
      Object.keys(BAY_LAYOUT).sort(),
    );
  });

  it("keeps every pan a valid background-position percentage", () => {
    for (const pan of Object.values(CARD_PAN)) {
      expect(pan).toBeGreaterThanOrEqual(0);
      expect(pan).toBeLessThanOrEqual(100);
    }
  });
});

describe("cardCrop", () => {
  it("crops the upper floor's band at the bay's pan", () => {
    expect(cardCrop("-1", 64)).toEqual({
      backgroundImage: 'url("/parking-bg.jpg")',
      backgroundSize: "906px 384px",
      backgroundPosition: "68% 0px",
    });
  });

  it("scrolls down to the lower floor's band", () => {
    expect(cardCrop("-2", 86)).toEqual({
      backgroundImage: 'url("/parking-bg.jpg")',
      backgroundSize: "1001px 424px",
      backgroundPosition: "30% -224px",
    });
  });

  it("returns null for a floor the art has no band for", () => {
    expect(cardCrop("", NaN)).toBeNull();
    expect(cardCrop("-3", 12)).toBeNull();
  });

  it("returns null for a bay without a pan, even on a known floor", () => {
    expect(cardCrop("-1", 99)).toBeNull();
  });
});

describe("groupSpotsByFloor", () => {
  it("orders floors top to bottom with unknown names last", () => {
    const groups = groupSpotsByFloor([
      spot(1, "A1"),
      spot(2, "-2/086"),
      spot(3, "-1/070"),
    ]);
    expect(groups.map((g) => g.floor)).toEqual(["-1", "-2", ""]);
  });

  it("orders spots within a floor as they appear in the artwork", () => {
    const groups = groupSpotsByFloor([
      spot(1, "-1/062"),
      spot(2, "-1/066"),
      spot(3, "-1/071"),
      spot(4, "-1/064"),
    ]);
    expect(groups[0].spots.map((s) => s.name)).toEqual([
      "-1/071",
      "-1/066",
      "-1/064",
      "-1/062",
    ]);
  });

  it("appends bays the artwork does not know after the known ones", () => {
    const groups = groupSpotsByFloor([
      spot(1, "-1/099"),
      spot(2, "-1/062"),
      spot(3, "-1/071"),
    ]);
    expect(groups[0].spots.map((s) => s.name)).toEqual([
      "-1/071",
      "-1/062",
      "-1/099",
    ]);
  });

  it("groups names without a floor separator under the unknown floor", () => {
    const groups = groupSpotsByFloor([spot(1, "B2"), spot(2, "A1")]);
    expect(groups).toEqual([
      { floor: "", spots: [spot(2, "A1"), spot(1, "B2")] },
    ]);
  });
});

describe("floorLabel", () => {
  it("keeps the artwork's Czech floor labels", () => {
    expect(floorLabel("-1")).toBe("PODLAŽÍ -1");
    expect(floorLabel("-2")).toBe("PODLAŽÍ -2");
  });

  it("labels the unknown floor generically", () => {
    expect(floorLabel("")).toBe("OTHER SPOTS");
  });
});

describe("freeMeta", () => {
  it("counts free spots out of the total", () => {
    expect(
      freeMeta([
        spot(1, "-1/070", "Michal B."),
        spot(2, "-1/067"),
        spot(3, "-1/064"),
      ]),
    ).toBe("2 of 3 free");
  });

  it("reports a fully booked floor", () => {
    expect(freeMeta([spot(1, "-1/070", "Michal B.")])).toBe("0 of 1 free");
  });
});

describe("cardAriaLabel", () => {
  it("describes a free spot with its action", () => {
    expect(cardAriaLabel(spot(1, "-1/064"), false)).toBe(
      "Spot 64, floor -1, free — tap to park",
    );
  });

  it("names the occupant of a taken spot", () => {
    expect(cardAriaLabel(spot(1, "-1/063", "Damián"), false)).toBe(
      "Spot 63, floor -1, taken by Damián",
    );
  });

  it("describes the user's own spot with its action", () => {
    expect(cardAriaLabel(spot(1, "-1/064", "Jan Novák"), true)).toBe(
      "Spot 64, floor -1, yours — tap to leave",
    );
  });

  it("carries the accessibility marker", () => {
    expect(cardAriaLabel(spot(1, "-1/063 ♿️"), false)).toBe(
      "Spot 63 (accessible), floor -1, free — tap to park",
    );
  });

  it("falls back to the raw name for spots without a floor", () => {
    expect(cardAriaLabel(spot(1, "A1"), false)).toBe(
      "Spot A1, free — tap to park",
    );
  });
});
