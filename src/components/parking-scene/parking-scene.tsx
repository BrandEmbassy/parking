import { component$, useSignal, type Signal, type QRL } from "@builder.io/qwik";
import type { SpotData, ReserveResult } from "~/services/types";
import {
  BAY_LABELS,
  BAY_LAYOUT,
  CAR_DEFS_HTML,
  SCENE_H,
  SCENE_W,
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
  /** Which spot has its confirm editor open; shared with the grid's editor state. */
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
 * and "Park here" affordances on free bays. Interaction matches the classic grid:
 * clicking a free bay or your own car opens an inline confirm editor (name input +
 * Reserve, or Leave), so nothing is booked or released on a single click.
 *
 * Spots whose bay number is not in BAY_LAYOUT (art has no slot for them) fall back
 * to a compact card strip below the scene so no bookable spot is ever hidden.
 */
export const ParkingScene = component$<ParkingSceneProps>((props) => {
  const internalEditingSpot = useSignal<number | null>(null);
  const editValue = useSignal("");

  const editingSpot = props.editingSpot ?? internalEditingSpot;

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

        {/*
          Bay numbers painted on the back wall. They used to be baked into the
          background image; the current art has them removed, so we draw them.
          Purely decorative — every bay's number is already announced through the
          bay's own aria-label — and first in the stage so cars park in front of it.
        */}
        <svg
          aria-hidden="true"
          class="parking-scene__labels"
          viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        >
          <g class="bay-label bay-label--halo">
            {BAY_LABELS.map((l) => (
              <text key={l.bay} x={l.x} y={l.y} font-size={l.fontSize}>
                {l.bay}
              </text>
            ))}
          </g>
          <g class="bay-label bay-label--paint">
            {BAY_LABELS.map((l) => (
              <text
                key={l.bay}
                x={l.x}
                y={l.y}
                font-size={l.fontSize}
                fill={l.fill}
              >
                {l.bay}
              </text>
            ))}
          </g>
        </svg>

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

          const isEditing = editingSpot.value === spot.spotId;

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
                  title={`${label} — free, click to reserve`}
                  aria-label={`${label} — free, click to reserve`}
                  onClick$={() => {
                    editingSpot.value = spot.spotId;
                    editValue.value = userName;
                  }}
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
                {isEditing && (
                  <div class="bay__editor">
                    <form
                      preventdefault:submit
                      onSubmit$={() => {
                        const spotId = spot.spotId;
                        const value = editValue.value;
                        editingSpot.value = null;
                        props.onSave$?.(spotId, value, "");
                      }}
                    >
                      <input
                        type="text"
                        class="spot-input"
                        value={editValue.value}
                        onInput$={(_, el) => {
                          editValue.value = el.value;
                        }}
                        placeholder="Enter name..."
                        autoFocus
                      />
                      <div class="spot-actions">
                        <button type="submit" class="btn btn-small btn-primary">
                          Reserve
                        </button>
                        <button
                          type="button"
                          class="btn btn-small btn-outline"
                          aria-label="Cancel"
                          onClick$={() => {
                            editingSpot.value = null;
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    </form>
                  </div>
                )}
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
                onClick$={() => {
                  if (!isMine) return;
                  editingSpot.value = spot.spotId;
                }}
              >
                <svg
                  viewBox={useSide ? SIDE_VB : FRONT_VB}
                  preserveAspectRatio="xMidYMax meet"
                  style={carStyle}
                >
                  <use href={useSide ? "#carSide" : "#carFront"} />
                </svg>
              </div>
              {isMine && isEditing ? (
                <div class="bay__editor">
                  <div class="spot-actions">
                    <button
                      type="button"
                      class="btn btn-small btn-danger"
                      onClick$={() => {
                        const spotId = spot.spotId;
                        const occupant = spot.occupant;
                        editingSpot.value = null;
                        props.onSave$?.(spotId, "", occupant);
                      }}
                    >
                      Leave
                    </button>
                    <button
                      type="button"
                      class="btn btn-small btn-outline"
                      aria-label="Cancel"
                      onClick$={() => {
                        editingSpot.value = null;
                      }}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ) : (
                <div class={`bay__chip ${isMine ? "bay__chip--mine" : ""}`}>
                  <span class="bay__avatar">{initialsOf(spot.occupant)}</span>
                  <span class="bay__name">{shortNameOf(spot.occupant)}</span>
                </div>
              )}
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
              const isEditing = editingSpot.value === spot.spotId;
              const canEdit = isFree || isMine;
              return (
                <div
                  key={spot.spotId}
                  class={`spot-card ${isFree ? "spot-free" : isMine ? "spot-mine" : "spot-taken"} ${isEditing ? "spot-editing" : ""} ${canEdit ? "" : "spot-inert"}`}
                  onClick$={() => {
                    if (!canEdit) return;
                    editingSpot.value = spot.spotId;
                    editValue.value = isFree ? userName : "";
                  }}
                >
                  <div class="spot-name">{spot.name}</div>
                  {isEditing && canEdit ? (
                    isFree ? (
                      <form
                        preventdefault:submit
                        onClick$={(e) => e.stopPropagation()}
                        onSubmit$={() => {
                          const spotId = spot.spotId;
                          const value = editValue.value;
                          editingSpot.value = null;
                          props.onSave$?.(spotId, value, "");
                        }}
                      >
                        <input
                          type="text"
                          class="spot-input"
                          value={editValue.value}
                          onInput$={(_, el) => {
                            editValue.value = el.value;
                          }}
                          placeholder="Enter name..."
                          autoFocus
                        />
                        <div class="spot-actions">
                          <button
                            type="submit"
                            class="btn btn-small btn-primary"
                          >
                            Reserve
                          </button>
                          <button
                            type="button"
                            class="btn btn-small btn-outline"
                            aria-label="Cancel"
                            onClick$={() => {
                              editingSpot.value = null;
                            }}
                          >
                            &times;
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div
                        class="spot-taken-edit"
                        onClick$={(e) => e.stopPropagation()}
                      >
                        <span class="spot-reserved">{spot.occupant}</span>
                        <div class="spot-actions">
                          <button
                            type="button"
                            class="btn btn-small btn-danger"
                            onClick$={() => {
                              const spotId = spot.spotId;
                              const occupant = spot.occupant;
                              editingSpot.value = null;
                              props.onSave$?.(spotId, "", occupant);
                            }}
                          >
                            Leave
                          </button>
                          <button
                            type="button"
                            class="btn btn-small btn-outline"
                            aria-label="Cancel"
                            onClick$={() => {
                              editingSpot.value = null;
                            }}
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div class="spot-occupant">
                      {isFree ? (
                        <span class="spot-available">Available</span>
                      ) : (
                        <span class="spot-reserved">{spot.occupant}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
