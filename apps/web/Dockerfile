FROM node:22-alpine AS build
WORKDIR /workspace
ARG VITE_API_GATEWAY_URL=http://localhost:8080
ENV VITE_API_GATEWAY_URL=$VITE_API_GATEWAY_URL
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN npm install
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w @arcade/contracts
RUN npm run build -w @arcade/web

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
RUN printf 'server { listen 8080; root /usr/share/nginx/html; index index.html; location / { try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
