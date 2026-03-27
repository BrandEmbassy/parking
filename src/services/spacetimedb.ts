/**
 * SpacetimeDB connection service for the Qwik parking app.
 *
 * This replaces the entire Google Sheets data layer (sheets.ts, spot-actions.ts, use-polling.ts).
 * It manages a WebSocket connection to SpacetimeDB Cloud and provides:
 * - Real-time spot and reservation data via subscriptions
 * - Reducer calls for reserve/cancel/quick-reserve
 * - Connection status tracking
 *
 * Since Qwik is not React, we don't use SpacetimeDB's React hooks.
 * Instead we manage the connection imperatively and sync data to Qwik signals.
 */

import { DbConnection } from "~/module_bindings";
import type { Reservation, Spot } from "~/module_bindings/types";

// Environment config — baked in at build time via Vite (PUBLIC_ prefix required for client exposure)
const SPACETIMEDB_URI = import.meta.env.PUBLIC_SPACETIMEDB_URI as string;
const SPACETIMEDB_MODULE = import.meta.env.PUBLIC_SPACETIMEDB_MODULE as string;

if (!SPACETIMEDB_URI || !SPACETIMEDB_MODULE) {
  throw new Error(
    "Missing SpacetimeDB config. Ensure PUBLIC_SPACETIMEDB_URI and PUBLIC_SPACETIMEDB_MODULE are set in .env",
  );
}

// Module-level singleton connection
let connection: DbConnection | null = null;
let connectionPromise: Promise<DbConnection> | null = null;
let isConnected = false;

// Data cache — updated by subscription callbacks
let spots: Spot[] = [];
let reservations: Reservation[] = [];

// Listeners for data changes
type DataListener = () => void;
const listeners = new Set<DataListener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function onDataChange(listener: DataListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get or create the SpacetimeDB connection singleton.
 * Returns a promise that resolves when the connection is established and data is loaded.
 */
export function getConnection(): Promise<DbConnection> {
  if (connection && isConnected) return Promise.resolve(connection);
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve, reject) => {
    try {
      const conn = DbConnection.builder()
        .withUri(SPACETIMEDB_URI)
        .withDatabaseName(SPACETIMEDB_MODULE)
        .onConnect((conn: DbConnection) => {
          console.log("[SpacetimeDB] Connected");
          isConnected = true;

          // Subscribe to all spots and reservations
          conn
            .subscriptionBuilder()
            .onApplied(() => {
              console.log("[SpacetimeDB] Subscription applied, data loaded");
              // Initial data load
              syncDataFromConnection(conn);
              resolve(conn);
            })
            .onError((ctx) => {
              console.error("[SpacetimeDB] Subscription error:", ctx);
            })
            .subscribe(["SELECT * FROM spot", "SELECT * FROM reservation"]);
        })
        .onConnectError((_ctx, err: Error) => {
          console.error("[SpacetimeDB] Connection error:", err);
          connectionPromise = null;
          isConnected = false;
          reject(err);
        })
        .onDisconnect(() => {
          console.log("[SpacetimeDB] Disconnected");
          isConnected = false;
          connection = null;
          connectionPromise = null;
          notifyListeners();
        })
        .build();

      connection = conn;

      // Set up table change callbacks for real-time updates
      conn.db.spot.onInsert(() => {
        syncDataFromConnection(conn);
      });
      conn.db.spot.onDelete(() => {
        syncDataFromConnection(conn);
      });
      conn.db.reservation.onInsert(() => {
        syncDataFromConnection(conn);
      });
      conn.db.reservation.onDelete(() => {
        syncDataFromConnection(conn);
      });
    } catch (err) {
      connectionPromise = null;
      reject(err);
    }
  });

  return connectionPromise;
}

/**
 * Sync cached data from the live connection's table state.
 */
function syncDataFromConnection(conn: DbConnection) {
  spots = [...conn.db.spot].sort((a, b) => a.sortOrder - b.sortOrder);
  reservations = [...conn.db.reservation];
  notifyListeners();
}

/**
 * Get current connection status.
 */
export function getIsConnected(): boolean {
  return isConnected;
}

// ---------------------------------------------------------------------------
// Data accessors
// ---------------------------------------------------------------------------

export function getSpots(): Spot[] {
  return spots;
}

export function getReservations(): Reservation[] {
  return reservations;
}

/**
 * Get reservations for a specific date.
 */
export function getReservationsForDate(date: string): Reservation[] {
  return reservations.filter((r) => r.date === date);
}

/**
 * Build the spot data for a given date, compatible with the UI expectations.
 * Returns spots with their reservation status for that date.
 */
export function getSpotsForDate(date: string): Array<{
  spotId: number;
  name: string;
  occupant: string;
  sortOrder: number;
}> {
  const dateReservations = getReservationsForDate(date);
  const reservationBySpotId = new Map<number, string>();
  for (const r of dateReservations) {
    reservationBySpotId.set(r.spotId, r.occupant);
  }

  return spots.map((spot) => ({
    spotId: spot.id,
    name: spot.name,
    occupant: reservationBySpotId.get(spot.id) || "",
    sortOrder: spot.sortOrder,
  }));
}

/**
 * Get the count of free spots for a date.
 */
export function getFreeCount(date: string): number {
  const dateReservations = getReservationsForDate(date);
  const reservedSpotIds = new Set(dateReservations.map((r) => r.spotId));
  return spots.filter((s) => !reservedSpotIds.has(s.id)).length;
}

// ---------------------------------------------------------------------------
// Actions (reducer calls)
// ---------------------------------------------------------------------------

export async function reserveSpot(
  spotId: number,
  date: string,
  occupant: string,
): Promise<void> {
  const conn = await getConnection();
  await conn.reducers.reserveSpot({ spotId, date, occupant });
}

export async function cancelReservation(
  spotId: number,
  date: string,
  occupant: string,
): Promise<void> {
  const conn = await getConnection();
  await conn.reducers.cancelReservation({ spotId, date, occupant });
}

export async function quickReserve(
  date: string,
  occupant: string,
): Promise<void> {
  const conn = await getConnection();
  await conn.reducers.quickReserve({ date, occupant });
}

/**
 * Wait for the next data sync from SpacetimeDB subscriptions.
 * Useful after mutations to ensure cached data reflects the change.
 */
export function waitForDataSync(timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = { unsub: () => {} };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup.unsub();
      reject(new Error("Data sync timeout"));
    }, timeoutMs);
    cleanup.unsub = onDataChange(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup.unsub();
      resolve();
    });
  });
}
