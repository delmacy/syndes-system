FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY apps/master-admin-api/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps/master-admin-api/src/ ./src/
USER node
EXPOSE 8085
CMD ["node","src/main.mjs"]
