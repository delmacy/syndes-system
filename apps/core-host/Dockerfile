FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY packages/core-kernel/package*.json packages/core-kernel/
COPY packages/core-kernel/tsconfig.json packages/core-kernel/
COPY packages/core-kernel/src packages/core-kernel/src
RUN cd packages/core-kernel && npm ci --no-audit --no-fund && npm run build
COPY apps/core-host/package*.json apps/core-host/
COPY apps/core-host/tsconfig.json apps/core-host/
COPY apps/core-host/src apps/core-host/src
RUN cd apps/core-host && npm ci --no-audit --no-fund && npm run build
FROM node:22-bookworm-slim
WORKDIR /workspace/apps/core-host
ENV NODE_ENV=production
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build --chown=app:app /workspace /workspace
USER app
EXPOSE 8082
CMD ["node","dist/main.js"]
