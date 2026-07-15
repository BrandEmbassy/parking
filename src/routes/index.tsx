import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { ConnectionStatus } from "~/components/poll-status/poll-status";
import { SpotsGrid } from "~/components/spots-grid/spots-grid";
import { useSpacetimeDay } from "~/hooks/use-spacetimedb";
import {
  formatDate,
  formatDateDisplay,
  getDayName,
  addDays,
} from "~/services/date-utils";
import type { ReserveResult } from "~/services/types";
import {
  reserveSpot,
  cancelReservation,
  quickReserve,
} from "~/services/spacetimedb";

import { useSession } from "./layout";

export default component$(() => {
  const session = useSession();

  const today = new Date();
  const todayStr = formatDate(today);
  const dateStr = formatDateDisplay(today);
  const dayName = getDayName(today);

  const prevUrl = `/day/${formatDate(addDays(today, -1))}`;
  const nextUrl = `/day/${formatDate(addDays(today, 1))}`;

  const { data, connected, error, changedSpots } = useSpacetimeDay(todayStr);

  const editingSpot = useSignal<number | null>(null);

  const spots = useComputed$(() => data.value?.spots || []);
  const freeCount = useComputed$(
    () => spots.value.filter((s) => !s.occupant).length,
  );

  const mySpot = useComputed$(() =>
    spots.value.find(
      (s) =>
        s.occupant &&
        s.occupant.toLowerCase() === session.value.name.toLowerCase(),
    ),
  );

  // Quick reserve state
  const quickReserveResult = useSignal<ReserveResult | null>(null);
  const quickReserveRunning = useSignal(false);

  // Reserve (manual edit) state
  const reserveResult = useSignal<ReserveResult | null>(null);

  if (!session.value.isLoggedIn) {
    return (
      <div class="container">
        <a href={prevUrl} class="day-nav-prev" aria-label="Previous day">
          ‹
        </a>
        <a href={nextUrl} class="day-nav-next" aria-label="Next day">
          ›
        </a>
        <div class="today-header">
          <h1>NiCE Prague Parking</h1>
          <p>
            NiCE Prague Parking is an internal tool for the Prague office which
            allows employees to view and reserve available parking spaces for
            the day. Sign in with your Google account to see today's
            availability in real time, claim a specific spot, or use Quick
            Reserve to grab the first free one instantly.
          </p>
        </div>
        <div class="card">
          <p class="text-center" style="margin-bottom: 0.75rem;">
            Sign in with your Google account to get started.
          </p>
          <p class="text-center">
            <a href="/api/auth" class="btn btn-primary">
              Sign in with Google
            </a>
          </p>
          <p
            class="text-center text-muted"
            style="margin-top: 1rem; font-size: 0.8125rem;"
          >
            By signing in you agree to our{" "}
            <a href="/privacy/">Privacy Policy</a> and{" "}
            <a href="/terms/">Terms of Service</a>.
          </p>
        </div>
      </div>
    );
  }

  if (!data.value) {
    return (
      <div class="container">
        <a href={prevUrl} class="day-nav-prev" aria-label="Previous day">
          ‹
        </a>
        <a href={nextUrl} class="day-nav-next" aria-label="Next day">
          ›
        </a>
        <div class="today-header">
          <h1>Today</h1>
          <p class="date-display">
            {dayName}, {dateStr}
          </p>
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
      <a href={prevUrl} class="day-nav-prev" aria-label="Previous day">
        ‹
      </a>
      <a href={nextUrl} class="day-nav-next" aria-label="Next day">
        ›
      </a>
      <div class="today-header">
        <div class="stats">
          <span
            class={`stat-badge ${freeCount.value === 0 ? "stat-badge-full" : freeCount.value <= 3 ? "stat-badge-low" : "stat-badge-available"}`}
          >
            {freeCount.value} / {spots.value.length} spots free
          </span>
        </div>
        <h1>Today</h1>
        <p class="date-display">
          {dayName}, {dateStr}
        </p>
      </div>

      {mySpot.value && (
        <div class="my-reservation-banner">
          You have spot <strong>{mySpot.value.name}</strong> today
        </div>
      )}

      <div class="actions-bar">
        <button
          type="button"
          class="btn btn-primary"
          disabled={freeCount.value === 0 || quickReserveRunning.value}
          onClick$={async () => {
            quickReserveResult.value = null;
            quickReserveRunning.value = true;

            try {
              await quickReserve(todayStr, session.value.name);
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
              // Reserve the spot
              await reserveSpot(spotId, todayStr, value);
            } else {
              // Cancel/clear the reservation
              await cancelReservation(spotId, todayStr, expectedValue);
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
  title: "NiCE Prague Parking",
  meta: [
    {
      name: "description",
      content: "View and reserve parking spots for today",
    },
  ],
};
