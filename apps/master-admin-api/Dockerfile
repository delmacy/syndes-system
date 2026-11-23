FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY apps/master-admin-api/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps/master-admin-api/src/ ./src/
# The approved release checkout is deliberately created under umask 077.
# Docker COPY preserves 0700 source directories / 0600 source files owned by
# root; nonroot Node would fail with EACCES before the application starts.
# These are application sources, NOT secrets. Keep mounted credentials 0600.
RUN chmod 0644 package.json package-lock.json \
 && find src -type d -exec chmod 0755 {} + \
 && find src -type f -exec chmod 0644 {} +
# The host mounts a 0600 database URL file here. Create a traversable
# parent path before dropping privileges; never relax the file itself.
RUN install -d -m 0755 /run/secrets
USER 1000:1000
EXPOSE 8085
CMD ["node","src/main.mjs"]
