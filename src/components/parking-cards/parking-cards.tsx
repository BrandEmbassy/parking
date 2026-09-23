import { component$, type Signal, type QRL } from "@builder.io/qwik";
import type { SpotData, ReserveResult } from "~/services/types";
import {
  BAY_LAYOUT,
  FRONT_VB,
  SIDE_VB,
  MINE_HUE,
  hueFromName,
  initialsOf,
  shortNameOf,
  parseSpotName,
} from "../parking-scene/scene-data";
import {
  cardCrop,
  cardAriaLabel,
  floorLabel,
  freeMeta,
  groupSpotsByFloor,
} from "./card-data";

interface ParkingCardsProps {
  spots: SpotData[];
  userName?: string;
  changedSpots?: Signal<number[]>;
  reserveResult?: Signal<ReserveResult | null>;
  /**
   * value = occupant name to reserve, or "" to clear.
   * expectedValue = the occupant we expect to clear (for conflict detection).
   */
  onSave$?: QRL<
    (spotId: number, value: string, expectedValue: string) => Promise<void>
  >;
}

/**
 * The garage scene's narrow-viewport rendering: one fluid grid of spot cards per
 * floor, each card cropping the garage artwork at its bay's position. Rendered
 * by ParkingScene next to the wide stage; CSS media queries decide which of the
 * two is visible, so both server and client always render the same tree.
 *
 * Interaction matches the scene: tap a free card to park yourself, tap your own
 * card (or Cancel in the sticky bar) to leave; other people's cards are inert.
 */
export const ParkingCards = component$<ParkingCardsProps>((props) => {
  const userName = props.userName ?? "";
  const changed = props.changedSpots?.value ?? [];
  const result = props.reserveResult?.value;
  const failedSpotId =
    result && !result.success ? result.failedSpotId : undefined;

  const mySpot = props.spots.find(
    (s) =>
      s.occupant &&
      !!userName &&
      s.occupant.toLowerCase() === userName.toLowerCase(),
  );
  const mySpotNum = mySpot
    ? (() => {
        const bay = parseSpotName(mySpot.name).bay;
        return Number.isNaN(bay) ? mySpot.name : String(bay);
      })()
    : "";

  return (
    <div class={`parking-cards ${mySpot ? "parking-cards--with-bar" : ""}`}>
      {groupSpotsByFloor(props.spots).map((group) => (
        <section key={group.floor || "other"} class="floor-section">
          <div class="floor-head">
            <span class="floor-badge">{floorLabel(group.floor)}</span>
            <span class="floor-meta">{freeMeta(group.spots)}</span>
          </div>
          <div class="pcard-grid">
            {group.spots.map((spot) => {
              const parsed = parseSpotName(spot.name);
              const layout = BAY_LAYOUT[parsed.bay];
              const crop = cardCrop(parsed.floor, parsed.bay);
              const isFree = !spot.occupant;
              const isMine = spot.spotId === mySpot?.spotId;
              const numText = Number.isNaN(parsed.bay)
                ? spot.name
                : String(parsed.bay);

              const useSide = layout ? layout.side : true;
              const flip = layout ? layout.flip && layout.side : false;
              const hue = isMine ? MINE_HUE : hueFromName(spot.occupant);

              const stateClasses = [
                isMine ? "pcard--mine" : "",
                !isFree && !isMine ? "pcard--taken" : "",
                changed.includes(spot.spotId) ? "pcard--changed" : "",
                failedSpotId === spot.spotId ? "pcard--error" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  type="button"
                  key={spot.spotId}
                  class={`pcard ${stateClasses}`}
                  style={crop ? { ...crop } : undefined}
                  aria-label={cardAriaLabel(spot, isMine)}
                  aria-disabled={!isFree && !isMine ? "true" : undefined}
                  onClick$={() => {
                    if (isFree) {
                      return props.onSave$?.(spot.spotId, userName, "");
                    }
                    if (isMine) {
                      return props.onSave$?.(spot.spotId, "", spot.occupant);
                    }
                  }}
                >
                  <span class="pcard__glaze" aria-hidden="true" />
                  <span class="pcard__scrim" aria-hidden="true" />
                  <svg class="pcard__num" viewBox="0 0 110 56" aria-hidden="true">
                    <text class="pcard__num-halo" x="4" y="44">
                      {numText}
                    </text>
                    <text
                      class="pcard__num-paint"
                      x="4"
                      y="44"
                      fill={layout?.label.fill ?? "#fff"}
                    >
                      {numText}
                    </text>
                  </svg>
                  {isMine && <span class="pcard__badge">YOURS</span>}
                  {isFree ? (
                    <span class="pcard__drop">
                      <span class="pcard__cta">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          aria-hidden="true"
                        >
                          <path d="M8 3.5v9M3.5 8h9" />
                        </svg>
                        Park here
                      </span>
                    </span>
                  ) : (
                    <>
                      <span class="pcard__car">
                        {/* transform on the svg, not the wrapper — the wrapper
                            runs the carIn animation, which would clobber it */}
                        <svg
                          viewBox={useSide ? SIDE_VB : FRONT_VB}
                          preserveAspectRatio="xMidYMax meet"
                          style={{
                            "--car-hue": String(hue),
                            transform: flip ? "scaleX(-1)" : "none",
                          }}
                        >
                          <use href={useSide ? "#carSide" : "#carFront"} />
                        </svg>
                      </span>
                      <span class="pcard__pill">
                        <span class="pcard__avatar">
                          {initialsOf(spot.occupant)}
                        </span>
                        <span class="pcard__name">
                          {shortNameOf(spot.occupant)}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {mySpot && (
        <div class="my-spot-bar">
          <div class="my-spot-bar__inner">
            <span class="my-spot-bar__tile" aria-hidden="true">
              {mySpotNum}
            </span>
            <span class="my-spot-bar__text">You have spot {mySpotNum}</span>
            <button
              type="button"
              class="my-spot-bar__cancel"
              onClick$={() =>
                props.onSave$?.(mySpot.spotId, "", mySpot.occupant)
              }
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
