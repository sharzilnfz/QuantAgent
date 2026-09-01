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
# Stage 3: Minimal runtime image with non-root user execution
# ==============================================================================
FROM base AS runner

WORKDIR /repo

ENV PORT=3000 \
    NODE_ENV=production \
    PNPM_HOME="/home/node/.local/share/pnpm" \
    PATH="/home/node/.local/share/pnpm:/pnpm:$PATH"

# Copy installed node_modules and pnpm binaries with non-root ownership
COPY --from=deps --chown=node:node /pnpm /pnpm
COPY --from=deps --chown=node:node /repo /repo

# Copy application source code and monorepo packages
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/ packages/
COPY --chown=node:node apps/api/ apps/api/

USER node

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=5 \
    CMD node -e 'fetch("http://localhost:3000/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'

CMD ["pnpm", "--filter", "@committee/api", "start"]
