FROM node:22-alpine AS build
WORKDIR /workspace
COPY packages/contracts packages/contracts
COPY services/booking services/booking
RUN cd packages/contracts && npm install && npm run build
RUN cd services/booking && npm install && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/services/booking/dist ./dist
COPY --from=build /workspace/services/booking/node_modules ./node_modules
COPY --from=build /workspace/services/booking/package.json ./
USER node
CMD ["node", "dist/index.js"]
