# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /workspace
ARG VITE_API_GATEWAY_URL=http://localhost:4000
ENV VITE_API_GATEWAY_URL=$VITE_API_GATEWAY_URL \
    npm_config_audit=false \
    npm_config_fund=false

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/service-auth/package.json packages/service-auth/
COPY packages/observability/package.json packages/observability/
COPY apps/web/package.json apps/web/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY services/identity/package.json services/identity/
COPY services/catalog/package.json services/catalog/
COPY services/booking/package.json services/booking/
COPY services/payment/package.json services/payment/
COPY services/notification/package.json services/notification/
COPY services/inventory/package.json services/inventory/
COPY services/analytics/package.json services/analytics/
RUN npm ci

COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w @arcade/contracts \
    && npm run build -w @arcade/web

FROM nginxinc/nginx-unprivileged:1.27-alpine
ARG GIT_SHA=local
LABEL org.opencontainers.image.revision=$GIT_SHA
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
RUN printf 'server { listen 8080; root /usr/share/nginx/html; index index.html; location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null
