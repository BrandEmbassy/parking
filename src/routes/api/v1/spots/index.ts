import type { RequestHandler } from "@builder.io/qwik-city";
import {
  getConnection,
  getSpotsForDate,
  getFreeCount,
} from "~/services/spacetimedb";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    const spots = getSpotsForDate(date);
    const freeCount = getFreeCount(date);

    json(200, {
      date,
      spots: spots.map((s) => ({
        spotId: s.spotId,
        name: s.name,
        occupant: s.occupant || null,
        available: !s.occupant,
      })),
      total: spots.length,
      available: freeCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    json(500, { error: "Internal Server Error", message });
  }
};
