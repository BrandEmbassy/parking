/**
 * SpacetimeDB connection hook for Qwik.
 *
 * Replaces the old polling-based data refresh with real-time WebSocket subscriptions.
 * This hook initializes the SpacetimeDB connection on the client side and
 * provides reactive signals for spots and reservations data.
 */

import { useSignal, useVisibleTask$ } from "@builder.io/qwik";
import type { DayData } from "~/services/types";
import {
  getConnection,
  getIsConnected,
  getSpotsForDate,
  getSpots,
  onDataChange,
} from "~/services/spacetimedb";
import { getDayName } from "~/services/date-utils";

/**
 * Build a DayData object from SpacetimeDB data for a given date.
 */
function buildDayData(date: string): DayData | null {
  const spots = getSpots();
  if (spots.length === 0) return null;

  const spotsForDate = getSpotsForDate(date);
  const dateObj = new Date(date + "T12:00:00"); // Noon to avoid TZ issues

  return {
    date,
    day: getDayName(dateObj),
    spots: spotsForDate.map((s) => ({
      spotId: s.spotId,
      name: s.name,
      occupant: s.occupant,
    })),
  };
}

/**
 * Hook that connects to SpacetimeDB and provides reactive data for a single day.
 * Replaces useSpotPollingSignals + setupPolling + pollSpots.
 */
export function useSpacetimeDay(dateStr: string) {
  const data = useSignal<DayData | null>(null);
  const connected = useSignal(false);
  const error = useSignal<string | null>(null);
  const changedSpots = useSignal<number[]>([]);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    let prevSpots: Map<number, string> = new Map();

    const updateData = () => {
      const dayData = buildDayData(dateStr);
      if (!dayData) return;

      // Detect changes for glow animation
      const changed: number[] = [];
      for (const spot of dayData.spots) {
        const prevOccupant = prevSpots.get(spot.spotId);
        if (prevOccupant !== undefined && prevOccupant !== spot.occupant) {
          changed.push(spot.spotId);
        }
      }

      // Update previous state
      prevSpots = new Map(dayData.spots.map((s) => [s.spotId, s.occupant]));

      data.value = dayData;
      connected.value = getIsConnected();

      // Apply glow
      if (changed.length > 0) {
        changedSpots.value = [];
        requestAnimationFrame(() => {
          changedSpots.value = changed;
          setTimeout(() => {
            changedSpots.value = [];
          }, 2000);
        });
      }
    };

    // Listen for data changes from SpacetimeDB
    const unsubscribe = onDataChange(updateData);

    // Initialize connection
    getConnection()
      .then(() => {
        connected.value = true;
        updateData();
      })
      .catch((err) => {
        error.value = err instanceof Error ? err.message : "Connection failed";
      });

    cleanup(() => {
      unsubscribe();
    });
  });

  return { data, connected, error, changedSpots };
}

/**
 * Hook that provides reactive data for multiple upcoming days.
 * Replaces useDayListPollingSignals + setupPolling + pollDayList.
 */
export function useSpacetimeDays(dates: string[]) {
  const days = useSignal<DayData[]>([]);
  const connected = useSignal(false);
  const error = useSignal<string | null>(null);
  const changedDates = useSignal<string[]>([]);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const prevFreeCounts: Map<string, number> = new Map();

    const updateData = () => {
      const allDays: DayData[] = [];
      for (const date of dates) {
        const dayData = buildDayData(date);
        if (dayData) allDays.push(dayData);
      }
      if (allDays.length === 0) return;

      // Detect changed dates
      const changed: string[] = [];
      for (const day of allDays) {
        const freeCount = day.spots.filter((s) => !s.occupant).length;
        const prevFree = prevFreeCounts.get(day.date);
        if (prevFree !== undefined && prevFree !== freeCount) {
          changed.push(day.date);
        }
        prevFreeCounts.set(day.date, freeCount);
      }

      days.value = allDays;
      connected.value = getIsConnected();

      // Apply glow
      if (changed.length > 0) {
        changedDates.value = [];
        requestAnimationFrame(() => {
          changedDates.value = changed;
          setTimeout(() => {
            changedDates.value = [];
          }, 2000);
        });
      }
    };

    const unsubscribe = onDataChange(updateData);

    getConnection()
      .then(() => {
        connected.value = true;
        updateData();
      })
      .catch((err) => {
        error.value = err instanceof Error ? err.message : "Connection failed";
      });

    cleanup(() => {
      unsubscribe();
    });
  });

  return { days, connected, error, changedDates };
}
