FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/

# Build shared, then backend
RUN pnpm --filter @quantagent/shared build
RUN pnpm --filter @quantagent/backend build

EXPOSE 4000

CMD ["node", "packages/backend/dist/index.js"]
