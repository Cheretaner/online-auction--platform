# Stage 1 (build)
FROM node:24-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy root config and workspaces config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies (will fetch for whole workspace)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

# Build shared first, then api
RUN pnpm --filter @auction/shared build
RUN pnpm --filter @auction/api build

# Stage 2 (runtime)
FROM node:24-slim AS runtime

WORKDIR /app

# Copy built outputs and node_modules from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json

EXPOSE 3000

CMD ["node", "packages/api/dist/index.js"]

VOLUME ["/data/storage"]
