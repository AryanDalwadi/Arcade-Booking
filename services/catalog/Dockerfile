FROM node:22-alpine AS build
WORKDIR /workspace
COPY packages/contracts packages/contracts
COPY services/catalog services/catalog
RUN cd packages/contracts && npm install && npm run build
RUN cd services/catalog && npm install && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/services/catalog/dist ./dist
COPY --from=build /workspace/services/catalog/node_modules ./node_modules
COPY --from=build /workspace/services/catalog/package.json ./
USER node
CMD ["node", "dist/index.js"]
