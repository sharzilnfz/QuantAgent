FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo
ENV CI=true \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

# Install workspace dependencies using BuildKit cache mount (prevents duplicate store in image layers)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/fixtures/package.json packages/fixtures/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Copy application source code
COPY . .

EXPOSE 5173
CMD ["pnpm", "--filter", "@committee/web", "dev", "--host"]

