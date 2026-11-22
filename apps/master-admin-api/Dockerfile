FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY apps/master-admin-api/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps/master-admin-api/src/ ./src/
# The host mounts a 0600 database URL file here. Create a traversable
# parent path before dropping privileges; never relax the file itself.
RUN install -d -m 0755 /run/secrets
USER 1000:1000
EXPOSE 8085
CMD ["node","src/main.mjs"]
