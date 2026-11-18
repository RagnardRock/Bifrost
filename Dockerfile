# Bifrost — image de production.
# Le serveur tourne avec tsx (TypeScript lu directement) : seule l'interface et le paquet partagé sont construits.

FROM node:20-bookworm-slim AS construction
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci
COPY packages/shared packages/shared
COPY packages/client packages/client
RUN npm run build -w @bifrost/shared && npm run build -w @bifrost/client

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# openssl : demandé par Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN npm ci --omit=dev -w @bifrost/shared -w @bifrost/server --include-workspace-root=false && npm cache clean --force
COPY --from=construction /app/packages/shared/dist packages/shared/dist
COPY --from=construction /app/packages/client/dist packages/client/dist
COPY packages/server packages/server
RUN npx -w @bifrost/server prisma generate \
  && mkdir -p /data/sites /data/import \
  && chown -R node:node /data /app/packages/server
USER node

ENV PORT=3000 SITES_DIR=/data/sites IMPORT_DIR=/data/import
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Applique les migrations de la base, puis démarre
CMD ["npm", "run", "start:prod", "-w", "@bifrost/server"]
