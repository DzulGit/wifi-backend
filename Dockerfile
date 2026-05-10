# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install semua dependencies (termasuk devDependencies untuk build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build NestJS
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init untuk proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install hanya production dependencies
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client di production
RUN npx prisma generate

# Copy build output dari stage 1
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Non-root user untuk keamanan
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001
    # Tambah ini SEBELUM baris USER nestjs
RUN mkdir -p /app/public/uploads/payments && \
    chown -R nestjs:nodejs /app/public
USER nestjs

EXPOSE 3002

# Jalankan dengan dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]
