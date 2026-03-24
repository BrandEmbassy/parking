import { SenderError, t } from "spacetimedb/server";
import spacetimedb from "./schema";
export default spacetimedb;

// Called when the module is initially published
export const init = spacetimedb.init(() => {
  console.log("Parking module initialized");
});

// Reserve a specific spot for a date
export const reserveSpot = spacetimedb.reducer(
  { spotId: t.u32(), date: t.string(), occupant: t.string() },
  (ctx, { spotId, date, occupant }) => {
    // Validate inputs
    if (!occupant.trim()) {
      throw new SenderError("Occupant name is required");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new SenderError("Date must be in YYYY-MM-DD format");
    }

    // Check if spot exists
    const spot = ctx.db.spot.id.find(spotId);
    if (!spot) {
      throw new SenderError(`Spot with id ${spotId} does not exist`);
    }

    // Check if already reserved (scan reservations for this date+spot)
    for (const res of ctx.db.reservation.reservation_spot_id.filter(spotId)) {
      if (res.date === date) {
        throw new SenderError(
          `Spot ${spot.name} is already reserved on ${date} by ${res.occupant}`,
        );
      }
    }

    // Insert reservation
    ctx.db.reservation.insert({
      id: 0n, // auto-increment
      spotId,
      date,
      occupant: occupant.trim(),
    });

    console.log(`${occupant.trim()} reserved spot ${spot.name} on ${date}`);
  },
);

// Cancel a reservation (occupant must match)
export const cancelReservation = spacetimedb.reducer(
  { spotId: t.u32(), date: t.string(), occupant: t.string() },
  (ctx, { spotId, date, occupant }) => {
    // Find the reservation for this spot+date
    let found = false;
    for (const res of ctx.db.reservation.reservation_spot_id.filter(spotId)) {
      if (res.date === date) {
        if (res.occupant !== occupant) {
          throw new SenderError(
            `Only ${res.occupant} can cancel this reservation`,
          );
        }
        ctx.db.reservation.id.delete(res.id);
        found = true;
        console.log(`${occupant} cancelled reservation for spot on ${date}`);
        break;
      }
    }

    if (!found) {
      throw new SenderError(`No reservation found for this spot on ${date}`);
    }
  },
);

// Quick reserve: find first free spot for a date
export const quickReserve = spacetimedb.reducer(
  { date: t.string(), occupant: t.string() },
  (ctx, { date, occupant }) => {
    if (!occupant.trim()) {
      throw new SenderError("Occupant name is required");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new SenderError("Date must be in YYYY-MM-DD format");
    }

    // Check if user already has a reservation for this date
    for (const res of ctx.db.reservation.reservation_date.filter(date)) {
      if (res.occupant === occupant.trim()) {
        throw new SenderError(`You already have a reservation on ${date}`);
      }
    }

    // Collect all reserved spot IDs for this date
    const reservedSpotIds = new Set<number>();
    for (const res of ctx.db.reservation.reservation_date.filter(date)) {
      reservedSpotIds.add(res.spotId);
    }

    // Find first available spot (ordered by sortOrder)
    const allSpots = [...ctx.db.spot.iter()].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    for (const spot of allSpots) {
      if (!reservedSpotIds.has(spot.id)) {
        ctx.db.reservation.insert({
          id: 0n,
          spotId: spot.id,
          date,
          occupant: occupant.trim(),
        });
        console.log(
          `${occupant.trim()} quick-reserved spot ${spot.name} on ${date}`,
        );
        return;
      }
    }

    throw new SenderError(`No free spots available on ${date}`);
  },
);

// Admin: seed spot definitions (for initial data migration)
export const seedSpots = spacetimedb.reducer(
  { names: t.array(t.string()) },
  (ctx, { names }) => {
    // Clear existing spots first
    for (const spot of [...ctx.db.spot.iter()]) {
      ctx.db.spot.id.delete(spot.id);
    }

    // Insert new spots with sequential sort order
    for (let i = 0; i < names.length; i++) {
      ctx.db.spot.insert({
        id: 0, // auto-increment
        name: names[i],
        sortOrder: i,
      });
    }

    console.log(`Seeded ${names.length} parking spots: ${names.join(", ")}`);
  },
);
