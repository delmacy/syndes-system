FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY apps/master-admin-web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/master-admin-web/tsconfig.json apps/master-admin-web/vite.config.ts apps/master-admin-web/index.html ./
COPY apps/master-admin-web/src/ ./src/
COPY apps/master-admin-web/public/ ./public/
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
USER root
COPY apps/master-admin-web/deploy/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/ /usr/share/nginx/html/
RUN chmod 0644 /etc/nginx/conf.d/default.conf && \
    find /usr/share/nginx/html -type d -exec chmod 0755 {} + && \
    find /usr/share/nginx/html -type f -exec chmod 0644 {} +
USER 101
EXPOSE 8080
