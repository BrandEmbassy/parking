import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { type DocumentHead, useLocation } from "@builder.io/qwik-city";
import { ConnectionStatus } from "~/components/poll-status/poll-status";
import { SpotsGrid } from "~/components/spots-grid/spots-grid";
import { useSpacetimeDay } from "~/hooks/use-spacetimedb";
import type { ReserveResult } from "~/services/types";
import {
  reserveSpot,
  cancelReservation,
  quickReserve,
} from "~/services/spacetimedb";

import { useSession } from "../../layout";

export default component$(() => {
  const session = useSession();
  const location = useLocation();
  const dateStr = decodeURIComponent(location.params.date);

  const { data, connected, error, changedSpots } = useSpacetimeDay(dateStr);

  const editingSpot = useSignal<number | null>(null);

  const spots = useComputed$(() => data.value?.spots || []);
  const freeCount = useComputed$(
    () => spots.value.filter((s) => !s.occupant).length,
  );

  // Quick reserve state
  const quickReserveResult = useSignal<ReserveResult | null>(null);
  const quickReserveRunning = useSignal(false);

  // Reserve (manual edit) state
  const reserveResult = useSignal<ReserveResult | null>(null);

  if (!session.value.isLoggedIn) {
    return (
      <div class="container">
        <div class="today-header">
          <a href="/future" class="back-link">
            &larr; Upcoming
          </a>
          <h1>Day Detail</h1>
        </div>
        <div class="card">
          <p class="text-center text-muted">
            Please sign in to view parking data.
          </p>
        </div>
      </div>
    );
  }

  if (!data.value) {
    return (
      <div class="container">
        <div class="today-header">
          <a href="/future" class="back-link">
            &larr; Upcoming
          </a>
          <h1>Day Detail</h1>
        </div>
        <div class="card">
          <p class="text-center text-muted">
            {error.value ? `Error: ${error.value}` : "Loading parking data…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <div class="today-header">
        <div class="stats">
          <span
            class={`stat-badge ${freeCount.value === 0 ? "stat-badge-full" : freeCount.value <= 3 ? "stat-badge-low" : "stat-badge-available"}`}
          >
            {freeCount.value} / {spots.value.length} spots free
          </span>
        </div>
        <a href="/future" class="back-link">
          &larr; Upcoming
        </a>
        <h1>{data.value.day}</h1>
        <p class="date-display">{data.value.date}</p>
      </div>

      <div class="actions-bar">
        <button
          type="button"
          class="btn btn-primary"
          disabled={freeCount.value === 0 || quickReserveRunning.value}
          onClick$={async () => {
            quickReserveResult.value = null;
            quickReserveRunning.value = true;

            try {
              await quickReserve(dateStr, session.value.name);
              quickReserveResult.value = { success: true };
            } catch (err) {
              quickReserveResult.value = {
                success: false,
                error:
                  err instanceof Error ? err.message : "Quick reserve failed",
              };
            }

            quickReserveRunning.value = false;
          }}
        >
          Quick Reserve
        </button>
        {quickReserveResult.value?.success && (
          <span class="success-msg">Reserved!</span>
        )}
        {quickReserveResult.value && !quickReserveResult.value.success && (
          <span class="error-msg">{quickReserveResult.value.error}</span>
        )}
      </div>

      <SpotsGrid
        spots={data.value.spots}
        userName={session.value.name}
        changedSpots={changedSpots}
        editingSpot={editingSpot}
        reserveResult={reserveResult}
        onSave$={async (spotId, value, expectedValue) => {
          try {
            if (value) {
              await reserveSpot(spotId, dateStr, value);
            } else {
              await cancelReservation(spotId, dateStr, expectedValue);
            }
            reserveResult.value = { success: true };
          } catch (err) {
            reserveResult.value = {
              success: false,
              error: err instanceof Error ? err.message : "Action failed",
              failedSpotId: spotId,
            };
          }
        }}
      />

      <ConnectionStatus connected={connected} error={error} />
    </div>
  );
});

export const head: DocumentHead = {
  title: "NiCE Prague Parking - Day Detail",
  meta: [
    {
      name: "description",
      content: "View and reserve parking spots for a specific day",
    },
  ],
};
