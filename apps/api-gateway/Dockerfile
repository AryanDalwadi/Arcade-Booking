FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/service-auth/package.json packages/service-auth/
COPY apps/api-gateway/package.json apps/api-gateway/
RUN npm install
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/service-auth packages/service-auth
COPY apps/api-gateway apps/api-gateway
RUN npm run build -w @arcade/contracts
RUN npm run build -w @arcade/service-auth
RUN npm run build -w @arcade/api-gateway

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/apps/api-gateway/dist ./dist
EXPOSE 8080
USER node
CMD ["node", "dist/server.js"]
