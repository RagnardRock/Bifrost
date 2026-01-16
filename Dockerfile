# Bifrost CMS - Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Install dependencies and build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies required for building
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY packages/client ./packages/client
COPY tsconfig.base.json ./

# Generate Prisma client
RUN npm run db:generate

# Build shared package
RUN npm run build -w @bifrost/shared

# Build server
RUN npm run build -w @bifrost/server

# Build client
RUN npm run build -w @bifrost/client

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bifrost -u 1001

# Copy package files
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy public assets (loader.js)
COPY packages/server/public ./packages/server/public

# Copy built client to be served by the server
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Set ownership to non-root user
RUN chown -R bifrost:nodejs /app

USER bifrost

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["npm", "run", "start:server"]
