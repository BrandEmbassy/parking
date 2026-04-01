# Parking Reservation

Web app for reserving office parking spots, backed by [SpacetimeDB](https://spacetimedb.com/?referral=enzy). Built with [Qwik](https://qwik.dev/) and [QwikCity](https://qwik.dev/qwikcity/overview/).

## Prerequisites

- Node.js `^18.17.0 || ^20.3.0 || >=21.0.0`
- A Google Cloud project with OAuth 2.0 credentials
- SpacetimeDB table

## Environment Variables

Copy the example file and fill in your credentials:

```shell
cp .env.example .env
```

| Variable                    | Description                                  | Required |
| --------------------------- | -------------------------------------------- | -------- |
| `GOOGLE_CLIENT_ID`          | Google OAuth 2.0 Client ID                   | Yes      |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth 2.0 Client Secret               | Yes      |
| `PUBLIC_SPACETIMEDB_MODULE` | Database name                                | Yes      |
| `PUBLIC_SPACETIMEDB_URI`    | Database cluster                             | Yes      |
| `API_KEYS`                  | Comma-separated API keys for REST API access | No       |

## Project Structure

```
├── public/              Static assets
├── src/
│   ├── components/      Shared components
│   ├── routes/          Directory-based routing (pages + API endpoints)
│   ├── services/        Google Sheets & OAuth helpers
│   ├── plugins/         Fastify server plugin
│   ├── entry.ssr.tsx    SSR entry point
│   └── entry.fastify.tsx  Production server entry point
└── adapters/
    └── fastify/         Fastify adapter Vite config
```

## Development

```shell
npm install
npm start
```

The dev server runs at `http://localhost:5173` with SSR and hot module replacement.

## Production Build

```shell
npm run build
```

This generates `dist/` (client assets) and `server/` (Fastify server bundle). To run it locally:

```shell
ORIGIN=http://localhost:3000 npm run serve
```

The `ORIGIN` environment variable is required for CSRF protection and must match the URL users access the app from.

## Docker

### Build and run with Docker

```shell
docker build -t nice-parking .
docker run -p 3000:3000 --env-file .env -e ORIGIN=https://your-domain.com nice-parking
```

### Docker Compose (recommended)

```shell
# Start in the background
docker compose up -d

# With a custom origin
ORIGIN=https://your-domain.com docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The compose file reads credentials from your `.env` file and defaults `ORIGIN` to `http://localhost:3000` if not set.

## REST API

A REST API (`/api/v1`) is available for AI agent and programmatic access. Authentication is via Bearer token — set the `API_KEYS` environment variable with one or more comma-separated keys.

- **AI agent guidance**: [`/llms.txt`](public/llms.txt) — plain-language overview and workflow tips
- **OpenAPI spec**: [`/openapi.json`](public/openapi.json) — machine-readable specification for tool generation

### Production Checklist

- Set `ORIGIN` to your actual domain (e.g. `https://parking.example.com`) -- required for CSRF protection
- Update `GOOGLE_REDIRECT_URI` in your Google Cloud Console to match your production callback URL (`https://your-domain.com/api/auth/callback`)
- Ensure outbound HTTPS access to `accounts.google.com` and `googleapis.com`
