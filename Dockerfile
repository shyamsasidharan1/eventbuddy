# Multi-stage build for production-ready NestJS application
FROM node:20-alpine AS builder

# Install build dependencies including OpenSSL compatibility
RUN apk add --no-cache libc6-compat openssl-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm ci --only=production && npm cache clean --force

# Production image
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 eventbuddy

# Copy built application and production dependencies
COPY --from=builder --chown=eventbuddy:nodejs /app/dist ./dist
COPY --from=builder --chown=eventbuddy:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=eventbuddy:nodejs /app/package*.json ./
COPY --from=builder --chown=eventbuddy:nodejs /app/prisma ./prisma

# Create necessary directories
RUN mkdir -p logs temp && \
    chown -R eventbuddy:nodejs logs temp

# Switch to non-root user
USER eventbuddy

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]