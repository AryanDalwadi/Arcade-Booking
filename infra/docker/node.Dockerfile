# syntax=docker/dockerfile:1.7
# One educational image recipe for every npm workspace. Keep service-specific
# Dockerfiles beside the service later if native dependencies diverge.
FROM node:22-alpine AS build
WORKDIR /workspace

ARG WORKSPACE
ARG SERVICE_PATH
ENV npm_config_audit=false \
    npm_config_fund=false

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY ${SERVICE_PATH} ./${SERVICE_PATH}

# Resolve optional native packages inside the Linux image rather than reusing a
# lock generated on a different developer operating system.
RUN test -n "$WORKSPACE" && test -n "$SERVICE_PATH" \
    && npm install \
    && npm run build --workspace "@arcade/contracts" \
    && npm run build --workspace "@arcade/service-auth" \
    && npm run build --workspace "$WORKSPACE" --if-present \
    && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /workspace

ARG WORKSPACE
ARG SERVICE_PATH
ENV NODE_ENV=production \
    PORT=4000 \
    WORKSPACE_NAME=$WORKSPACE \
    SERVICE_PATH=$SERVICE_PATH

COPY --from=build --chown=node:node /workspace/package*.json ./
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/packages ./packages
COPY --from=build --chown=node:node /workspace/${SERVICE_PATH} ./${SERVICE_PATH}

USER node
EXPOSE 4000
CMD ["sh", "-c", "node \"$SERVICE_PATH/dist/config/migrate.js\" && npm start --workspace \"$WORKSPACE_NAME\""]
