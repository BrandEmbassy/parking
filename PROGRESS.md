# Parking Reservation System - Progress

## Status: Migrated to SpacetimeDB

### Migration Tasks

| #   | Task                                                        | Status |
| --- | ----------------------------------------------------------- | ------ |
| 1   | Initialize Qwik project with QwikCity                       | Done   |
| 2   | Set up Google OAuth 2.0 authentication (profile scope only) | Done   |
| 3   | Create SpacetimeDB server module (tables + reducers)        | Done   |
| 4   | Generate SpacetimeDB client bindings                        | Done   |
| 5   | Create SpacetimeDB connection service (real-time WebSocket) | Done   |
| 6   | Migrate Today View to SpacetimeDB subscriptions             | Done   |
| 7   | Migrate Future View to SpacetimeDB subscriptions            | Done   |
| 8   | Migrate Day Detail View to SpacetimeDB subscriptions        | Done   |
| 9   | Remove Google Sheets dependency (googleapis)                | Done   |
| 10  | Reduce OAuth scope to profile only                          | Done   |
| 11  | Update privacy policy and legal pages                       | Done   |

### Architecture

```
spacetimedb/           - SpacetimeDB server module
  src/
    schema.ts          - Tables (spot, reservation)
    index.ts           - Reducers (reserveSpot, cancelReservation, quickReserve, seedSpots)
  package.json
  tsconfig.json
spacetime.json         - SpacetimeDB project config

src/
  module_bindings/     - Auto-generated SpacetimeDB client bindings
  services/
    auth.ts        - Google OAuth 2.0 helpers (profile scope only, no googleapis)
    spacetimedb.ts - SpacetimeDB connection manager (WebSocket, subscriptions)
    types.ts       - Shared TypeScript interfaces (SpotData, DayData, ReserveResult)
    date-utils.ts  - Pure date formatting utilities
  hooks/
    use-spacetimedb.ts - Qwik hooks for SpacetimeDB (useSpacetimeDay, useSpacetimeDays)
  components/
    spots-grid/    - Parking spots grid component
    poll-status/   - Connection status indicator (was polling status)
  routes/
    layout.tsx     - App shell with header, nav, auth state
    index.tsx      - Today View (real-time spot grid, quick reserve)
    future/
      index.tsx    - Upcoming 14 days list (real-time)
    day/[date]/
      index.tsx    - Day detail view (real-time)
    api/auth/
      index.ts     - Redirects to Google OAuth
      callback/
        index.ts   - Handles OAuth callback, sets cookies
      logout/
        index.ts   - Clears auth cookies
  global.css       - Full app styling
```

### Key Changes from Google Sheets

- **Real-time updates** via WebSocket instead of 30s polling
- **Atomic operations** via SpacetimeDB reducers (no race conditions)
- **Reduced OAuth scope** from 3 scopes (profile + email + spreadsheets) to 1 (profile only)
- **Removed googleapis dependency** (~30MB), replaced with direct fetch for OAuth token exchange
- **No refresh tokens needed** — only fetching user name at login
- **SpacetimeDB Cloud** as the database (typed tables with constraints)

### To Run

1. Copy `.env.example` to `.env` and fill in your Google OAuth credentials
2. `npm install`
3. `cd spacetimedb && npm install`
4. `npm run dev`

### To Deploy SpacetimeDB Module

```bash
spacetime publish nice-parking
```

### To Seed Parking Spots

```bash
spacetime call nice-parking seedSpots '{"names": ["A1", "A2", "A3", "B1", "B2"]}'
```

### Environment Variables

| Variable               | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth 2.0 Client ID                                              |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret                                          |
| `GOOGLE_REDIRECT_URI`  | OAuth callback URL (default: `http://localhost:5173/api/auth/callback`) |
| `SPACETIMEDB_MODULE`   | SpacetimeDB module name                                                 |
| `SPACETIMEDB_URI`      | SpacetimeDB Cloud URI (default: `wss://maincloud.spacetimedb.com`)      |
