ARG NODE_VERSION=24

################################################################################
# Base image for all stages
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

################################################################################
# Install all dependencies (including devDependencies needed for build)
FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci

################################################################################
# Install production dependencies only
FROM base AS prod-deps

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

################################################################################
# Build the application
FROM deps AS build

# SpacetimeDB connection config is baked into the client bundle at build time
# (Vite resolves PUBLIC_* vars during `npm run build`), so it must be provided
# here rather than only at runtime. Overridable via --build-arg.
ARG PUBLIC_SPACETIMEDB_URI=wss://maincloud.spacetimedb.com
ARG PUBLIC_SPACETIMEDB_MODULE
ENV PUBLIC_SPACETIMEDB_URI=$PUBLIC_SPACETIMEDB_URI \
    PUBLIC_SPACETIMEDB_MODULE=$PUBLIC_SPACETIMEDB_MODULE

COPY . .

RUN npm run build

################################################################################
# Production image
FROM base AS production

ENV NODE_ENV=production

# Run as non-root user for security
USER node

# Copy package files (needed for Node.js module resolution)
COPY --chown=node:node package.json ./

# Copy production-only node_modules
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

# Copy built client assets and server bundle
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/server ./server

EXPOSE 3000

CMD ["node", "server/entry.fastify"]
