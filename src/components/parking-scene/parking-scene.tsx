import { component$, type Signal, type QRL } from "@builder.io/qwik";
import type { SpotData, ReserveResult } from "~/services/types";
import {
  BAY_LAYOUT,
  CAR_DEFS_HTML,
  FRONT_VB,
  SIDE_VB,
  MINE_HUE,
  bayBox,
  parseSpotName,
  hueFromName,
  initialsOf,
  shortNameOf,
} from "./scene-data";

interface ParkingSceneProps {
  spots: SpotData[];
  userName?: string;
  /** Kept for prop compatibility with the old grid; unused by the scene. */
  editingSpot?: Signal<number | null>;
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
 * Renders parking spots as a cartoon-garage scene: cars parked in the painted
 * bays of a fixed background illustration, coloured per occupant, with name chips
 * and "Park here" affordances on free bays. Interaction is self-service — click a
 * free bay to park yourself, click your own car to leave.
 *
 * Spots whose bay number is not in BAY_LAYOUT (art has no slot for them) fall back
 * to a compact card strip below the scene so no bookable spot is ever hidden.
 */
export const ParkingScene = component$<ParkingSceneProps>((props) => {
  const result = props.reserveResult?.value;
  const hasError = result && !result.success;
  const allTaken =
    props.spots.length > 0 && props.spots.every((s) => s.occupant);
  const changed = props.changedSpots?.value ?? [];
  const userName = props.userName ?? "";

  const fallback: SpotData[] = [];

  return (
    <div class="parking-scene">
      {allTaken && <div class="fully-booked-banner">All spots are taken</div>}
      {hasError && (
        <div class="conflict-banner">
          <p>{result.error}</p>
          <button
            type="button"
            class="conflict-dismiss"
            onClick$={() => {
              if (props.reserveResult) {
                props.reserveResult.value = null;
              }
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div class="parking-scene__stage">
        <svg
          aria-hidden="true"
          class="parking-scene__defs"
          dangerouslySetInnerHTML={CAR_DEFS_HTML}
        />

        {props.spots.map((spot) => {
          const parsed = parseSpotName(spot.name);
          const layout = BAY_LAYOUT[parsed.bay];

          if (!layout) {
            fallback.push(spot);
            return null;
          }

          const isFree = !spot.occupant;
          const isMine =
            !isFree &&
            !!userName &&
            spot.occupant.toLowerCase() === userName.toLowerCase();
          const isChanged = changed.includes(spot.spotId);
          const isFailed = hasError && result.failedSpotId === spot.spotId;
          const box = bayBox(layout);
          const label = parsed.accessible
            ? `Bay ${parsed.bay} (accessible)`
            : `Bay ${parsed.bay}`;

          if (isFree) {
            return (
              <div
                key={spot.spotId}
                class={`bay ${isFailed ? "bay--error" : ""}`}
                style={{ ...box }}
              >
                <button
                  type="button"
                  class="bay__free"
                  title={`${label} — free, click to park`}
                  aria-label={`${label} — free, click to park`}
                  onClick$={() => props.onSave$?.(spot.spotId, userName, "")}
                >
                  <span class="bay__pill">
                    <svg
                      width="12"
                      height="12"
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
                </button>
              </div>
            );
          }

          const hue = isMine ? MINE_HUE : hueFromName(spot.occupant);
          const useSide = layout.side;
          const carStyle: Record<string, string> = {
            "--car-hue": String(hue),
            transform: layout.flip && useSide ? "scaleX(-1)" : "none",
          };
          const carTitle = isMine
            ? `Your ${label.toLowerCase()} — click to leave`
            : `${spot.occupant} · ${label.toLowerCase()}`;

          return (
            <div
              key={spot.spotId}
              class={`bay ${isChanged ? "bay--changed" : ""} ${isFailed ? "bay--error" : ""}`}
              style={{ ...box }}
            >
              <div
                class={`bay__car ${isMine ? "bay__car--mine" : ""}`}
                title={carTitle}
                onClick$={
                  isMine
                    ? () => props.onSave$?.(spot.spotId, "", spot.occupant)
                    : undefined
                }
              >
                <svg
                  viewBox={useSide ? SIDE_VB : FRONT_VB}
                  preserveAspectRatio="xMidYMax meet"
                  style={carStyle}
                >
                  <use href={useSide ? "#carSide" : "#carFront"} />
                </svg>
              </div>
              <div class={`bay__chip ${isMine ? "bay__chip--mine" : ""}`}>
                <span class="bay__avatar">{initialsOf(spot.occupant)}</span>
                <span class="bay__name">{shortNameOf(spot.occupant)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {fallback.length > 0 && (
        <div class="parking-scene__fallback">
          <p class="parking-scene__fallback-title">Other bays</p>
          <div class="spots-grid">
            {fallback.map((spot) => {
              const isFree = !spot.occupant;
              const isMine =
                !isFree &&
                !!userName &&
                spot.occupant.toLowerCase() === userName.toLowerCase();
              return (
                <button
                  type="button"
                  key={spot.spotId}
                  class={`spot-card ${isFree ? "spot-free" : isMine ? "spot-mine" : "spot-taken"}`}
                  disabled={!isFree && !isMine}
                  onClick$={() =>
                    isFree
                      ? props.onSave$?.(spot.spotId, userName, "")
                      : props.onSave$?.(spot.spotId, "", spot.occupant)
                  }
                >
                  <div class="spot-name">{spot.name}</div>
                  <div class="spot-occupant">
                    {isFree ? (
                      <span class="spot-available">Available</span>
                    ) : (
                      <span class="spot-reserved">{spot.occupant}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
