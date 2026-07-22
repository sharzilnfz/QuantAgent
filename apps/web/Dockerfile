# Multi-stage build for the React dashboard web app within pnpm workspace.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo
ENV CI=true

# Install workspace deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY . .

EXPOSE 5173
CMD ["pnpm", "--filter", "@committee/web", "dev", "--host"]
