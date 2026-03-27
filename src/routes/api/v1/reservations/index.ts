import type { RequestHandler } from "@builder.io/qwik-city";
import {
  getConnection,
  getReservationsForDate,
  getSpots,
  reserveSpot,
  cancelReservation,
} from "~/services/spacetimedb";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/v1/reservations?date=YYYY-MM-DD
 * List all reservations for a given date.
 */
export const onGet: RequestHandler = async ({ query, json }) => {
  const date = query.get("date");
  if (!date || !DATE_RE.test(date)) {
    json(400, {
      error: "Bad Request",
      message: "Query parameter 'date' is required (YYYY-MM-DD)",
    });
    return;
  }

  try {
    await getConnection();
    const reservations = getReservationsForDate(date);
    const spots = getSpots();
    const spotById = new Map(spots.map((s) => [s.id, s.name]));

    json(200, {
      date,
      reservations: reservations.map((r) => ({
        spotId: r.spotId,
        spotName: spotById.get(r.spotId) ?? null,
        occupant: r.occupant,
      })),
      count: reservations.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    json(500, { error: "Internal Server Error", message });
  }
};

/**
 * POST /api/v1/reservations
 * Reserve a specific spot.
 * Body: { spotId: number, date: string, occupant: string }
 */
export const onPost: RequestHandler = async ({ request, json }) => {
  let body: { spotId?: number; date?: string; occupant?: string };
  try {
    body = await request.json();
  } catch {
    json(400, { error: "Bad Request", message: "Invalid JSON body" });
    return;
  }

  const { spotId, date, occupant } = body;
  if (typeof spotId !== "number" || !date || !occupant?.trim()) {
    json(400, {
      error: "Bad Request",
      message:
        "Body must include 'spotId' (number), 'date' (YYYY-MM-DD), and 'occupant' (non-empty string)",
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
    await reserveSpot(spotId, date, occupant.trim());

    const spots = getSpots();
    const spotName = spots.find((s) => s.id === spotId)?.name ?? null;

    json(201, {
      success: true,
      spotId,
      spotName,
      date,
      occupant: occupant.trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (
      message.includes("already reserved") ||
      message.includes("does not exist")
    ) {
      json(409, { error: "Conflict", message });
    } else {
      json(500, { error: "Internal Server Error", message });
    }
  }
};

/**
 * DELETE /api/v1/reservations
 * Cancel a reservation.
 * Body: { spotId: number, date: string, occupant: string }
 */
export const onDelete: RequestHandler = async ({ request, json }) => {
  let body: { spotId?: number; date?: string; occupant?: string };
  try {
    body = await request.json();
  } catch {
    json(400, { error: "Bad Request", message: "Invalid JSON body" });
    return;
  }

  const { spotId, date, occupant } = body;
  if (typeof spotId !== "number" || !date || !occupant?.trim()) {
    json(400, {
      error: "Bad Request",
      message:
        "Body must include 'spotId' (number), 'date' (YYYY-MM-DD), and 'occupant' (non-empty string)",
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
    await cancelReservation(spotId, date, occupant.trim());

    json(200, { success: true, spotId, date });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (
      message.includes("No reservation found") ||
      message.includes("Only ")
    ) {
      json(409, { error: "Conflict", message });
    } else {
      json(500, { error: "Internal Server Error", message });
    }
  }
};
