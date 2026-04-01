import type { RequestHandler } from "@builder.io/qwik-city";
import {
  getConnection,
  getSpotsForDate,
  quickReserve,
  waitForDataSync,
} from "~/services/spacetimedb";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/v1/reservations/quick
 * Auto-assign the first available spot for a date.
 * Body: { date: string, occupant: string }
 */
export const onPost: RequestHandler = async ({ request, json }) => {
  let body: { date?: string; occupant?: string };
  try {
    body = await request.json();
  } catch {
    json(400, { error: "Bad Request", message: "Invalid JSON body" });
    return;
  }

  const { date, occupant } = body;
  if (!date || !occupant?.trim()) {
    json(400, {
      error: "Bad Request",
      message:
        "Body must include 'date' (YYYY-MM-DD) and 'occupant' (non-empty string)",
    });
    return;
  }
  if (!DATE_RE.test(date)) {
    json(400, {
      error: "Bad Request",
      message: "'date' must be in YYYY-MM-DD format",
    });
    return;
  }

  try {
    await getConnection();
    await quickReserve(date, occupant.trim());

    // Wait for subscription to sync the new reservation into the cache
    try {
      await waitForDataSync();
    } catch {
      // Timeout is non-fatal — we still return success, just without spot details
    }

    const spots = getSpotsForDate(date);
    const assigned = spots.find((s) => s.occupant === occupant.trim());

    json(201, {
      success: true,
      date,
      occupant: occupant.trim(),
      spotId: assigned?.spotId ?? null,
      spotName: assigned?.name ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (
      message.includes("already have a reservation") ||
      message.includes("No free spots")
    ) {
      json(409, { error: "Conflict", message });
    } else {
      json(500, { error: "Internal Server Error", message });
    }
  }
};
