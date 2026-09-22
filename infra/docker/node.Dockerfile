# syntax=docker/dockerfile:1.7
# Multi-stage image for every Node microservice.
# Build stage compiles TypeScript. Runtime copies dist + migrations only.
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
# Keep WORKSPACE/SERVICE_PATH args after npm ci so the install layer is shared.
RUN npm ci

ARG WORKSPACE
ARG SERVICE_PATH
RUN test -n "$WORKSPACE" && test -n "$SERVICE_PATH"

COPY packages ./packages
COPY ${SERVICE_PATH} ./${SERVICE_PATH}
RUN npm run build --workspace "@arcade/contracts" \
    && npm run build --workspace "@arcade/service-auth" \
    && npm run build --workspace "@arcade/observability" \
    && npm run build --workspace "$WORKSPACE" --if-present \
    && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /workspace

ARG WORKSPACE
ARG SERVICE_PATH
ARG GIT_SHA=local
ENV NODE_ENV=production \
    PORT=4000 \
    SERVICE_PATH=$SERVICE_PATH
LABEL org.opencontainers.image.source="https://github.com/AryanDalwadi/Arcade-Booking" \
      org.opencontainers.image.revision=$GIT_SHA

COPY --from=build --chown=node:node /workspace/package.json /workspace/package-lock.json ./
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /workspace/packages/service-auth/package.json ./packages/service-auth/package.json
COPY --from=build --chown=node:node /workspace/packages/service-auth/dist ./packages/service-auth/dist
COPY --from=build --chown=node:node /workspace/packages/observability/package.json ./packages/observability/package.json
COPY --from=build --chown=node:node /workspace/packages/observability/dist ./packages/observability/dist
COPY --from=build --chown=node:node /workspace/${SERVICE_PATH}/package.json ./${SERVICE_PATH}/package.json
COPY --from=build --chown=node:node /workspace/${SERVICE_PATH}/dist ./${SERVICE_PATH}/dist
COPY --from=build --chown=node:node /workspace/${SERVICE_PATH}/migrations ./${SERVICE_PATH}/migrations

USER node
EXPOSE 4000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health/live').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
# Local Compose runs migrate then the process as one "release". Set
# MIGRATE_ON_START=false when a one-off Job already applied SQL.
CMD ["sh", "-c", "if [ \"${MIGRATE_ON_START:-true}\" = \"true\" ]; then node \"$SERVICE_PATH/dist/config/migrate.js\"; fi; exec node \"$SERVICE_PATH/dist/index.js\""]
