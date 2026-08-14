# Multi-stage build for the Node/TS API within the pnpm workspace.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo
ENV CI=true

# Install workspace deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY . .

EXPOSE 3000
CMD ["pnpm", "--filter", "@committee/api", "start"]
