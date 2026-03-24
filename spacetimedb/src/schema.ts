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

const spacetimedb = schema({ spot, reservation });
export default spacetimedb;
