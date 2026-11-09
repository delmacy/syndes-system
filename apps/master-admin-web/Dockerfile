# Build from the monorepo root. The frontend's file: dependency must
# exist at the same relative path as in the committed package-lock.json.
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY packages/front-shared/ ./packages/front-shared/
COPY apps/master-admin-web/package*.json ./apps/master-admin-web/
RUN cd apps/master-admin-web && npm ci --no-audit --no-fund
COPY apps/master-admin-web/tsconfig.json apps/master-admin-web/vite.config.ts apps/master-admin-web/index.html ./apps/master-admin-web/
COPY apps/master-admin-web/src/ ./apps/master-admin-web/src/
COPY apps/master-admin-web/public/ ./apps/master-admin-web/public/
RUN cd apps/master-admin-web && npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
USER root
COPY apps/master-admin-web/deploy/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/master-admin-web/dist/ /usr/share/nginx/html/
RUN chmod 0644 /etc/nginx/conf.d/default.conf && \
    find /usr/share/nginx/html -type d -exec chmod 0755 {} + && \
    find /usr/share/nginx/html -type f -exec chmod 0644 {} +
USER 101
EXPOSE 8080
