# ==============================================================================
# Stage 1: Base image with Node 22 and Corepack/pnpm enabled
# ==============================================================================
FROM node:22-slim AS base

ENV CI=true \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

RUN corepack enable

WORKDIR /repo

# ==============================================================================
# Stage 2: Workspace dependency installation with BuildKit cache mount
# ==============================================================================
FROM base AS deps

# Copy workspace configuration and package manifests for precise layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/fixtures/package.json packages/fixtures/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install workspace dependencies using BuildKit cache mount (keeps store out of image layers)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ==============================================================================
# Stage 3: Development server stage (default for local compose dev workflow)
# ==============================================================================
FROM base AS dev

WORKDIR /repo

ENV PNPM_HOME="/home/node/.local/share/pnpm" \
    PATH="/home/node/.local/share/pnpm:/pnpm:$PATH"

# Copy installed dependencies and workspace setup
COPY --from=deps --chown=node:node /pnpm /pnpm
COPY --from=deps --chown=node:node /repo /repo

# Copy source code
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/ packages/
COPY --chown=node:node apps/web/ apps/web/

USER node

EXPOSE 5173

CMD ["pnpm", "--filter", "@committee/web", "dev", "--host", "0.0.0.0", "--port", "5173"]

# ==============================================================================
# Stage 4: Production build stage (compiles static bundle)
# ==============================================================================
FROM dev AS builder

RUN pnpm --filter @committee/web build

# ==============================================================================
# Stage 5: Production preview/serving stage with non-root execution
# ==============================================================================
FROM base AS runner

WORKDIR /repo

ENV NODE_ENV=production \
    PNPM_HOME="/home/node/.local/share/pnpm" \
    PATH="/home/node/.local/share/pnpm:/pnpm:$PATH"

COPY --from=deps --chown=node:node /pnpm /pnpm
COPY --from=deps --chown=node:node /repo /repo
COPY --from=builder --chown=node:node /repo/apps/web/dist ./apps/web/dist
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/ packages/
COPY --chown=node:node apps/web/package.json apps/web/
COPY --chown=node:node apps/web/vite.config.ts apps/web/

USER node

EXPOSE 5173

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=5 \
    CMD node -e 'fetch("http://localhost:5173").then(r=>process.exit(r.ok||r.status===304?0:1)).catch(()=>process.exit(1))'

CMD ["pnpm", "--filter", "@committee/web", "preview", "--host", "0.0.0.0", "--port", "5173"]
