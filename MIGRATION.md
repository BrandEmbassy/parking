# Migration Plan: Google Sheets → SpacetimeDB

## Overview

Migrate the NiCE Prague Parking app from using Google Sheets as its database to SpacetimeDB Cloud, with a TypeScript module for server logic and direct WebSocket client connections for real-time updates. Reduce Google OAuth scope from profile+email+sheets to just a name (profile only).

## Current Architecture

```
Browser → Qwik SSR (server$ / routeLoader$) → Google Sheets API
           ↕ cookies (access_token, refresh_token, user_name, user_email)
           ↕ Google OAuth (profile + email + spreadsheets scopes)
```

**Pain points being solved:**

- Google Sheets API latency (~200-500ms per read/write)
- 30-second polling for updates instead of real-time
- Conflict detection via read-before-write (race condition window)
- Broad OAuth scope (`spreadsheets`) complicates Google app verification
- No proper database (no indexes, no constraints, no transactions)

## Target Architecture

```
Browser → SpacetimeDB Cloud (WebSocket, real-time subscriptions)
Browser → Qwik SSR (only for page rendering + auth)
           ↕ cookies (user_name only, from Google OAuth)
           ↕ Google OAuth (profile scope only)
```

---

## Phase 1: SpacetimeDB Module (Backend)

### 1.1 Project Setup

Create a new SpacetimeDB TypeScript module in the project:

```
parking/
├── server/              # SpacetimeDB module (NEW)
│   ├── src/
│   │   └── lib.ts       # Tables, reducers, subscriptions
│   ├── package.json
│   └── tsconfig.json
├── src/                 # Existing Qwik app
└── ...
```

**Commands:**

```bash
spacetime init --lang typescript server
cd server && npm install
```

### 1.2 Data Model Design

Current Google Sheets structure (flat spreadsheet):

- Row = date + day name + N parking spots (occupant names in cells)
- Header row = spot names
- `"X"` = divider (non-reservable column)

**SpacetimeDB tables:**

```typescript
// server/src/lib.ts

import { schema, table, t } from "spacetimedb/server";

const spacetimedb = schema({
  // Static parking spot definitions
  spot: table(
    { public: true },
    {
      id: t.u32(), // auto-incremented
      name: t.string(), // e.g. "A1", "A2", "B1"
      sortOrder: t.u32(), // display ordering
    },
  ),

  // Reservations (one per spot per date)
  reservation: table(
    { public: true },
    {
      spotId: t.u32(),
      date: t.string(), // "YYYY-MM-DD"
      occupant: t.string(), // User's display name (from Google OAuth)
    },
  ),
});
```

**Key design decisions:**

- **Spots** are a separate table (not hardcoded in columns) — allows adding/removing spots without restructuring
- **Reservations** use a composite key of `(spotId, date)` — one person per spot per day
- **No dividers in DB** — dividers are a UI concern; spot ordering via `sortOrder` is sufficient
- **Occupant = Google display name** — matches current behavior where the spreadsheet stores names

### 1.3 Reducers (Server-side Logic)

```typescript
// Reserve a spot
export const reserveSpot = spacetimedb.reducer(
  { spotId: t.u32(), date: t.string(), occupant: t.string() },
  (ctx, { spotId, date, occupant }) => {
    // Check if spot exists
    // Check if already reserved (atomic — no conflict possible)
    // Insert reservation
  },
);

// Cancel a reservation
export const cancelReservation = spacetimedb.reducer(
  { spotId: t.u32(), date: t.string(), occupant: t.string() },
  (ctx, { spotId, date, occupant }) => {
    // Find reservation, verify occupant matches, delete
  },
);

// Quick reserve: find first free spot for a date
export const quickReserve = spacetimedb.reducer(
  { date: t.string(), occupant: t.string() },
  (ctx, { date, occupant }) => {
    // Find all spots, check which don't have reservations for this date
    // Insert reservation for first available
  },
);

// Admin: seed spots (for initial data migration)
export const seedSpots = spacetimedb.reducer(
  { names: t.array(t.string()) },
  (ctx, { names }) => {
    // Bulk insert spot definitions
  },
);
```

**Conflict detection is no longer needed** — SpacetimeDB reducers are atomic. If two users try to reserve the same spot simultaneously, only one will succeed.

### 1.4 Publish to SpacetimeDB Cloud

```bash
spacetime publish nice-parking --module-path server/
spacetime generate --lang typescript --out-dir src/module_bindings --module-path server/
```

This generates TypeScript client bindings in `src/module_bindings/` that the Qwik frontend will import.

---

## Phase 2: Frontend Migration

### 2.1 Add SpacetimeDB Client SDK

```bash
npm install --save @clockworklabs/spacetimedb-sdk
```

### 2.2 Create SpacetimeDB Connection Service

**New file:** `src/services/spacetimedb.ts`

Replace the entire `sheets.ts` service with a SpacetimeDB connection manager:

```typescript
import { DbConnection } from "../module_bindings";

// Connect to SpacetimeDB Cloud
const connection = DbConnection.builder()
  .withUri("wss://maincloud.spacetimedb.com")
  .withModuleName("nice-parking")
  .onConnect((conn, identity, token) => {
    // Subscribe to all spots and reservations
    conn
      .subscriptionBuilder()
      .subscribe(["SELECT * FROM spot", "SELECT * FROM reservation"]);
  })
  .build();
```

### 2.3 Replace Route Data Loading

Currently each route uses `routeLoader$` + `server$` to fetch from Google Sheets. These will be replaced with client-side SpacetimeDB subscriptions.

**Files to modify:**

| File                              | Current                                             | After                                                     |
| --------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| `src/routes/index.tsx`            | `routeLoader$` → `getTodayData()` via Sheets API    | Client-side subscription to `spot` + `reservation` tables |
| `src/routes/future/index.tsx`     | `routeLoader$` → `getUpcomingDays()` via Sheets API | Client-side subscription with date range filter           |
| `src/routes/day/[date]/index.tsx` | `routeLoader$` → `getDayData()` via Sheets API      | Client-side subscription filtered by date                 |

**Key change:** Data loading moves from SSR (`routeLoader$`) to client-side WebSocket subscriptions. Pages will show a loading state until the SpacetimeDB connection is established and data is synced.

### 2.4 Replace Spot Actions

| Current (`spot-actions.ts`)                                 | SpacetimeDB equivalent                                |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| `reserveSpot()` → `sheets.updateSpot()` with conflict check | `connection.reducers.reserveSpot(spotId, date, name)` |
| `quickReserveSpot()` → find free + `updateSpot()`           | `connection.reducers.quickReserve(date, name)`        |
| Manual conflict detection (read-before-write)               | Automatic — reducers are atomic                       |

### 2.5 Remove Polling, Add Real-Time

**Delete/replace:** `src/hooks/use-polling.ts`

SpacetimeDB pushes changes to all connected clients in real-time via WebSocket. The current 30-second polling mechanism is entirely replaced:

```typescript
// Real-time updates via subscription callbacks
connection.db.reservation.onInsert((ctx, reservation) => {
  // UI updates automatically — spot shows as occupied
});

connection.db.reservation.onDelete((ctx, reservation) => {
  // UI updates automatically — spot shows as free
});
```

The `PollStatus` component ("Updated Xs ago") can be replaced with a connection status indicator (connected/disconnected).

### 2.6 Update Types

**Modify:** `src/services/types.ts`

The `SpotData` and `DayData` interfaces will be derived from or replaced by the generated SpacetimeDB bindings. The `colIndex` and `rowIndex` fields (spreadsheet-specific) can be removed.

---

## Phase 3: Auth Scope Reduction

### 3.1 Reduce OAuth Scopes

**Modify:** `src/services/auth.ts:17-21`

```typescript
// Before
scope: [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/spreadsheets",
];

// After
scope: ["https://www.googleapis.com/auth/userinfo.profile"];
```

This drops from 3 scopes to 1, and specifically removes the sensitive `spreadsheets` scope that requires extended Google app verification.

### 3.2 Simplify Auth Callback

**Modify:** `src/routes/api/auth/callback/index.ts`

- Remove `refresh_token` cookie — no longer needed (was only for Sheets API token refresh)
- Remove `user_email` cookie — no longer needed (scope reduced)
- Keep `access_token` cookie (short-lived, for fetching user name at login)
- Keep `user_name` cookie (used to identify the user in reservations)

### 3.3 Simplify Token Refresh

**Modify:** `src/routes/layout.tsx:11-42` and `src/services/auth.ts:46-54`

The token refresh logic was primarily needed to maintain Sheets API access. With only the profile scope:

- Remove `refreshAccessToken()` — no longer needed
- Simplify the `onRequest` middleware (remove refresh token handling)

### 3.4 Update Privacy Policy & Terms

**Modify:** `src/routes/privacy/index.tsx` and `src/routes/terms/index.tsx`

- Update data storage description (SpacetimeDB instead of Google Sheets)
- Update what personal data is collected (name only, no email)
- Update the "no server-side database" statement — there is now a database
- Update Google scopes description

---

## Phase 4: Cleanup & Deployment

### 4.1 Remove Google Sheets Dependencies

**Delete files:**

- `src/services/sheets.ts` — entire Google Sheets data layer
- `src/services/spot-actions.ts` — replaced by SpacetimeDB reducers

**Remove from `package.json`:**

- `googleapis` dependency (~30MB, the largest dependency)

**Remove from `.env` / `.env.example`:**

- `GOOGLE_SHEET_ID` — no longer needed

### 4.2 Update Environment Variables

**`.env.example` after migration:**

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/callback
SPACETIMEDB_MODULE=
SPACETIMEDB_URI=wss://maincloud.spacetimedb.com
```

### 4.3 Update Docker Configuration

**Modify:** `docker-compose.yml` — add SpacetimeDB-related env vars. No new containers needed since SpacetimeDB is hosted on their cloud.

### 4.4 Manual Data Migration

Since data will be migrated manually:

1. Export current spreadsheet's header row to get the list of spot names
2. Call `seedSpots` reducer via SpacetimeDB CLI or a one-time script to populate spot definitions
3. Optionally import existing reservations for future dates via a bulk reducer
4. Past reservation data does not need to be migrated (it's historical)

**Example via CLI:**

```bash
spacetime call nice-parking seedSpots '{"names": ["A1", "A2", "A3", "B1", "B2"]}'
```

### 4.5 Update UI Copy

- Remove "Sign in to access Google Spreadsheets" messaging (`src/routes/index.tsx:167`)
- Update app description text to reflect the new architecture
- Replace "Updated Xs ago" polling status with WebSocket connection status

---

## Files Changed Summary

| Action     | File                                         | Description                                                      |
| ---------- | -------------------------------------------- | ---------------------------------------------------------------- |
| **NEW**    | `server/` directory                          | SpacetimeDB TypeScript module (tables + reducers)                |
| **NEW**    | `src/module_bindings/`                       | Auto-generated SpacetimeDB client bindings                       |
| **NEW**    | `src/services/spacetimedb.ts`                | SpacetimeDB connection manager                                   |
| **MODIFY** | `src/services/auth.ts`                       | Reduce OAuth scopes to profile only; remove `refreshAccessToken` |
| **MODIFY** | `src/services/types.ts`                      | Update types (remove spreadsheet-specific fields)                |
| **MODIFY** | `src/routes/index.tsx`                       | Replace Sheets loading + polling with SpacetimeDB subscriptions  |
| **MODIFY** | `src/routes/future/index.tsx`                | Replace Sheets loading with SpacetimeDB subscriptions            |
| **MODIFY** | `src/routes/day/[date]/index.tsx`            | Replace Sheets loading with SpacetimeDB subscriptions            |
| **MODIFY** | `src/routes/layout.tsx`                      | Simplify auth middleware (remove token refresh)                  |
| **MODIFY** | `src/routes/api/auth/callback/index.ts`      | Remove email cookie + refresh token                              |
| **MODIFY** | `src/routes/privacy/index.tsx`               | Update privacy policy                                            |
| **MODIFY** | `src/routes/terms/index.tsx`                 | Update terms of service                                          |
| **MODIFY** | `src/hooks/use-polling.ts`                   | Replace polling with real-time connection status                 |
| **MODIFY** | `src/components/poll-status/poll-status.tsx` | Become connection status indicator                               |
| **MODIFY** | `package.json`                               | Remove `googleapis`, add SpacetimeDB SDK                         |
| **MODIFY** | `.env.example`                               | Update environment variables                                     |
| **MODIFY** | `docker-compose.yml`                         | Add SpacetimeDB env vars                                         |
| **MODIFY** | `PROGRESS.md`                                | Update architecture documentation                                |
| **DELETE** | `src/services/sheets.ts`                     | Google Sheets data layer (replaced by SpacetimeDB)               |
| **DELETE** | `src/services/spot-actions.ts`               | Spot actions (replaced by SpacetimeDB reducers)                  |

---

## Benefits After Migration

| Aspect           | Before (Google Sheets)                    | After (SpacetimeDB)              |
| ---------------- | ----------------------------------------- | -------------------------------- |
| Latency          | 200-500ms per API call                    | <50ms (WebSocket)                |
| Real-time        | 30s polling                               | Instant push updates             |
| Conflicts        | Read-before-write (race window)           | Atomic reducers (no races)       |
| OAuth scopes     | 3 scopes (incl. sensitive `spreadsheets`) | 1 scope (profile only)           |
| App verification | Extended verification required            | Standard verification sufficient |
| Dependencies     | `googleapis` (~30MB)                      | `@clockworklabs/spacetimedb-sdk` |
| Data integrity   | No constraints, plain text cells          | Typed tables with constraints    |

---

## Execution Order

1. **Phase 1** — SpacetimeDB module (can be developed independently)
2. **Phase 3.1** — Auth scope reduction (can start in parallel with Phase 1)
3. **Phase 2** — Frontend migration (depends on Phase 1: needs generated bindings)
4. **Phase 4.4** — Manual data migration (after Phase 1 is published to cloud)
5. **Phase 4** — Cleanup (after Phase 2 is complete and tested)
6. **Phase 3.2–3.4** — Auth simplification + legal pages (final polish)
