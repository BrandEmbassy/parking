import { component$, useSignal, type Signal, type QRL } from "@builder.io/qwik";
import type { SpotData, ReserveResult } from "~/services/types";

interface SpotsGridProps {
  spots: SpotData[];
  editingSpot?: Signal<number | null>;
  changedSpots?: Signal<number[]>;
  reserveResult?: Signal<ReserveResult | null>;
  onSave$?: QRL<
    (spotId: number, value: string, expectedValue: string) => Promise<void>
  >;
}

export const SpotsGrid = component$<SpotsGridProps>((props) => {
  const internalEditingSpot = useSignal<number | null>(null);
  const editValue = useSignal("");

  const editingSpot = props.editingSpot ?? internalEditingSpot;

  const result = props.reserveResult?.value;
  const hasError = result && !result.success;

  return (
    <div class="spots-grid">
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
      {props.spots.map((spot) => {
        const isEditing = editingSpot.value === spot.spotId;
        const isFree = !spot.occupant;
        const isChanged = (props.changedSpots?.value ?? []).includes(
          spot.spotId,
        );
        const isFailed = hasError && result.failedSpotId === spot.spotId;

        return (
          <div
            key={spot.spotId}
            class={`spot-card ${isFree ? "spot-free" : "spot-taken"} ${isEditing ? "spot-editing" : ""} ${isChanged ? "spot-changed" : ""} ${isFailed ? "spot-error" : ""}`}
          >
            <div class="spot-name">{spot.name}</div>

            {isEditing ? (
              isFree ? (
                // Free spot — show input to reserve
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
              ) : (
                // Taken spot — show occupant + clear action
                <div class="spot-taken-edit">
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
                      Clear
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
              <div
                class="spot-occupant"
                onClick$={() => {
                  editingSpot.value = spot.spotId;
                  editValue.value = "";
                }}
              >
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
  );
});
