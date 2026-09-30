import { schema, table, t } from "spacetimedb/server";

// Static parking spot definitions
const spot = table(
  {
    name: "spot",
    public: true,
  },
  {
    id: t.u32().primaryKey().autoInc(),
    name: t.string().unique(), // e.g. "A1", "A2", "B1"
    sortOrder: t.u32(), // display ordering
  },
);

// Reservations (one per spot per date)
const reservation = table(
  {
    name: "reservation",
    public: true,
    indexes: [
      {
        accessor: "reservation_spot_id",
        algorithm: "btree" as const,
        columns: ["spotId"],
      },
      {
        accessor: "reservation_date",
        algorithm: "btree" as const,
        columns: ["date"],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    spotId: t.u32(), // references spot.id
    date: t.string(), // "YYYY-MM-DD"
    occupant: t.string(), // User's display name (from Google OAuth)
  },
);

// The colour each person's car is drawn in on the garage scene. People without a
// row get a colour derived from their name, so this only holds explicit choices.
const carColor = table(
  {
    name: "car_color",
    public: true,
  },
  {
    // Trimmed, lower-cased display name — occupants are matched
    // case-insensitively everywhere else, so the colour follows suit.
    owner: t.string().primaryKey(),
    color: t.string(), // "#rrggbb"
  },
);

const spacetimedb = schema({ spot, reservation, carColor });
export default spacetimedb;
