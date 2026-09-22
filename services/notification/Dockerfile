FROM node:22-alpine AS build
WORKDIR /workspace
COPY packages/contracts packages/contracts
COPY services/notification services/notification
RUN cd packages/contracts && npm install && npm run build
RUN cd services/notification && npm install && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/services/notification/dist ./dist
COPY --from=build /workspace/services/notification/node_modules ./node_modules
COPY --from=build /workspace/services/notification/package.json ./
USER node
CMD ["node", "dist/index.js"]
