# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /workspace
ENV npm_config_audit=false \
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
COPY packages/service-auth packages/service-auth
COPY packages/observability packages/observability
COPY apps/api-gateway apps/api-gateway
RUN npm run build -w @arcade/contracts \
    && npm run build -w @arcade/service-auth \
    && npm run build -w @arcade/observability \
    && npm run build -w @arcade/api-gateway \
    && npm prune --omit=dev

FROM node:22-alpine
ARG GIT_SHA=local
ENV NODE_ENV=production
WORKDIR /app
LABEL org.opencontainers.image.revision=$GIT_SHA
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /workspace/packages/service-auth/package.json ./packages/service-auth/package.json
COPY --from=build --chown=node:node /workspace/packages/service-auth/dist ./packages/service-auth/dist
COPY --from=build --chown=node:node /workspace/packages/observability/package.json ./packages/observability/package.json
COPY --from=build --chown=node:node /workspace/packages/observability/dist ./packages/observability/dist
COPY --from=build --chown=node:node /workspace/apps/api-gateway/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/api-gateway/dist ./dist
USER node
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8080/health/live').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
