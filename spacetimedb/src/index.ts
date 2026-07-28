import { SenderError, t } from "spacetimedb/server";
import spacetimedb from "./schema";
export default spacetimedb;

// Called when the module is initially published
export const init = spacetimedb.init(() => {
  console.log("Parking module initialized");
});

/**
 * Identities allowed to call the destructive admin/migration reducers below.
 *
 * Reducers are callable by *any* client that can reach the module, and the web
 * app connects anonymously — so without this gate a visitor could wipe every
 * reservation. Add the hex identity of whoever runs the migration; find it with
 * `spacetime login show`. A rejected call reports the caller's identity, so an
 * unexpected "not authorized" error tells you exactly what to add here.
 */
const ADMIN_IDENTITIES = [
  "c20026b96bbb28a47d6189b3f510256f3f3f2950adc91680211e78745b32f19c",
];

function requireAdmin(ctx: { sender: { toHexString(): string } }): void {
  const sender = ctx.sender.toHexString();
  if (!ADMIN_IDENTITIES.includes(sender)) {
    throw new SenderError(
      `Not authorized: identity ${sender} may not call admin reducers`,
    );
  }
}

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
    requireAdmin(ctx);

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

// ---------------------------------------------------------------------------
// Migration reducers (used by scripts/migrate-from-sheet.mjs)
//
// These exist to import the legacy Google Spreadsheet — the previous data
// storage — into the database. The spreadsheet is the source of truth, so the
// import overwrites whatever is already here.
// ---------------------------------------------------------------------------

// Bring the spot list in line with the spreadsheet, keeping the id of every
// spot that keeps its name.
//
// Unlike `seedSpots` this does not re-create rows that already exist, so
// reservations pointing at those spots survive the import.
//
// `removeMissing` decides what happens to spots absent from `names`. Removing a
// spot has to take its reservations with it (they would otherwise dangle) — and
// those reservations may lie outside the dates being imported, so removal is
// opt-in rather than a side effect of a renamed or omitted spreadsheet column.
export const importSpots = spacetimedb.reducer(
  { names: t.array(t.string()), removeMissing: t.bool() },
  (ctx, { names, removeMissing }) => {
    requireAdmin(ctx);

    const wanted = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (wanted.length === 0) {
      throw new SenderError("At least one spot name is required");
    }
    if (new Set(wanted).size !== wanted.length) {
      throw new SenderError("Spot names must be unique");
    }

    let removedSpots = 0;
    let removedReservations = 0;
    const kept: string[] = [];

    for (const spot of [...ctx.db.spot.iter()]) {
      if (wanted.includes(spot.name)) continue;

      if (!removeMissing) {
        kept.push(spot.name);
        continue;
      }

      for (const res of [
        ...ctx.db.reservation.reservation_spot_id.filter(spot.id),
      ]) {
        ctx.db.reservation.id.delete(res.id);
        removedReservations++;
      }
      ctx.db.spot.id.delete(spot.id);
      removedSpots++;
    }

    // Upsert the wanted spots in spreadsheet column order. Spots kept above
    // sort after them, so they no longer sit between the imported ones.
    let inserted = 0;
    for (let i = 0; i < wanted.length; i++) {
      const existing = ctx.db.spot.name.find(wanted[i]);
      if (existing) {
        ctx.db.spot.id.update({ ...existing, sortOrder: i });
      } else {
        ctx.db.spot.insert({ id: 0, name: wanted[i], sortOrder: i });
        inserted++;
      }
    }
    for (let i = 0; i < kept.length; i++) {
      const spot = ctx.db.spot.name.find(kept[i]);
      if (spot) {
        ctx.db.spot.id.update({ ...spot, sortOrder: wanted.length + i });
      }
    }

    console.log(
      `importSpots: ${wanted.length} from the sheet (${inserted} new), ` +
        `${removedSpots} removed with ${removedReservations} reservations, ` +
        `${kept.length} left in place${kept.length > 0 ? `: ${kept.join(", ")}` : ""}`,
    );
  },
);

// Delete reservations before an import, so the spreadsheet fully overrides them.
//
// With `all = false` only the given dates are cleared, which keeps data for
// dates the imported spreadsheet does not cover (e.g. other years).
export const clearReservations = spacetimedb.reducer(
  { dates: t.array(t.string()), all: t.bool() },
  (ctx, { dates, all }) => {
    requireAdmin(ctx);

    let deleted = 0;

    if (all) {
      for (const res of [...ctx.db.reservation.iter()]) {
        ctx.db.reservation.id.delete(res.id);
        deleted++;
      }
      console.log(`clearReservations: deleted all ${deleted} reservations`);
      return;
    }

    for (const date of dates) {
      for (const res of [...ctx.db.reservation.reservation_date.filter(date)]) {
        ctx.db.reservation.id.delete(res.id);
        deleted++;
      }
    }

    console.log(
      `clearReservations: deleted ${deleted} reservations across ${dates.length} dates`,
    );
  },
);

// Bulk-insert reservations, addressing spots by name rather than by id.
//
// Called in batches so a full year fits comfortably in a single transaction.
// Any (spot, date) already taken is skipped rather than duplicated, which makes
// re-running a batch safe.
export const importReservations = spacetimedb.reducer(
  {
    entries: t.array(
      t.object("ImportEntry", {
        spotName: t.string(),
        date: t.string(),
        occupant: t.string(),
      }),
    ),
  },
  (ctx, { entries }) => {
    requireAdmin(ctx);

    let inserted = 0;
    let skipped = 0;

    for (const entry of entries) {
      const occupant = entry.occupant.trim();
      if (!occupant) {
        throw new SenderError(
          `Occupant is required (spot ${entry.spotName}, ${entry.date})`,
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        throw new SenderError(
          `Date must be in YYYY-MM-DD format, got "${entry.date}"`,
        );
      }

      const spot = ctx.db.spot.name.find(entry.spotName);
      if (!spot) {
        throw new SenderError(`Unknown spot "${entry.spotName}"`);
      }

      // Already taken? Leave it alone — makes retrying a batch idempotent.
      let taken = false;
      for (const res of ctx.db.reservation.reservation_date.filter(
        entry.date,
      )) {
        if (res.spotId === spot.id) {
          taken = true;
          break;
        }
      }
      if (taken) {
        skipped++;
        continue;
      }

      ctx.db.reservation.insert({
        id: 0n,
        spotId: spot.id,
        date: entry.date,
        occupant,
      });
      inserted++;
    }

    console.log(
      `importReservations: inserted ${inserted}, skipped ${skipped} already-reserved`,
    );
  },
);
