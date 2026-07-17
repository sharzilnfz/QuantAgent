FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/frontend/package.json packages/frontend/

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY packages/frontend/ packages/frontend/

RUN pnpm --filter @quantagent/frontend build

# --- Production ---
FROM nginx:alpine
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html

# SPA fallback + API proxy
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location /api/ {\n\
    proxy_pass http://backend:4000;\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
