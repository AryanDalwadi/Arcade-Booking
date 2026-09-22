FROM node:22-alpine AS build
WORKDIR /workspace
COPY packages/contracts packages/contracts
COPY services/payment services/payment
RUN cd packages/contracts && npm install && npm run build
RUN cd services/payment && npm install && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /workspace/services/payment/dist ./dist
COPY --from=build /workspace/services/payment/node_modules ./node_modules
COPY --from=build /workspace/services/payment/package.json ./
USER node
CMD ["node", "dist/index.js"]
