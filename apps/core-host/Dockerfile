FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY packages/core-kernel/package*.json packages/core-kernel/
COPY packages/core-kernel/tsconfig.json packages/core-kernel/
COPY packages/core-kernel/src packages/core-kernel/src
RUN cd packages/core-kernel && npm ci --no-audit --no-fund && npm run build
COPY modules/core-crm/package*.json modules/core-crm/
COPY modules/core-crm/tsconfig.json modules/core-crm/
COPY modules/core-crm/src modules/core-crm/src
COPY modules/core-crm/sql modules/core-crm/sql
COPY modules/core-crm/public modules/core-crm/public
RUN cd modules/core-crm && npm ci --no-audit --no-fund && npm run build
COPY apps/core-host/package*.json apps/core-host/
COPY apps/core-host/tsconfig.json apps/core-host/
COPY apps/core-host/src apps/core-host/src
COPY apps/core-host/config apps/core-host/config
COPY apps/core-host/scripts apps/core-host/scripts
RUN cd apps/core-host && npm ci --no-audit --no-fund && npm run link-peers && npm run build
FROM node:22-bookworm-slim
WORKDIR /workspace/apps/core-host
ENV NODE_ENV=production
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app app
COPY --from=build --chown=app:app /workspace /workspace
USER app
EXPOSE 8082
CMD ["node","dist/main.js"]
