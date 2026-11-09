FROM node:22-alpine
WORKDIR /opt/account-access
COPY apps/account-access-api/package.json apps/account-access-api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY apps/account-access-api/src/ ./src/
USER node
ENV NODE_ENV=production
EXPOSE 8086
CMD ["node","src/main.mjs"]
