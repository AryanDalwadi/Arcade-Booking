FROM node:22-alpine AS build
WORKDIR /workspace
COPY packages/contracts packages/contracts
COPY services/inventory services/inventory
RUN cd packages/contracts && npm install && npm run build
RUN cd services/inventory && npm install && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/services/inventory/dist ./dist
COPY --from=build /workspace/services/inventory/node_modules ./node_modules
COPY --from=build /workspace/services/inventory/package.json ./
USER node
CMD ["node", "dist/index.js"]
