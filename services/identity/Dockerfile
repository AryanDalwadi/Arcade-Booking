FROM node:22-alpine AS build
WORKDIR /workspace
COPY packages/contracts packages/contracts
COPY services/identity services/identity
RUN cd packages/contracts && npm install && npm run build
RUN cd services/identity && npm install && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/services/identity/dist ./dist
COPY --from=build /workspace/services/identity/node_modules ./node_modules
COPY --from=build /workspace/services/identity/package.json ./
USER node
CMD ["node", "dist/index.js"]
