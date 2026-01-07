# Production Dockerfile for OpenTracker
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm ci
RUN npm run build

# Production image, copy all the files and run nuxt
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# Copy built application
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output

# Copy files needed for database migrations
COPY --from=builder --chown=nuxtjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nuxtjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nuxtjs:nodejs /app/server/db ./server/db
COPY --from=builder --chown=nuxtjs:nodejs /app/scripts/seed-categories.ts ./scripts/seed-categories.ts
COPY --from=builder --chown=nuxtjs:nodejs /app/scripts/db-push.sh ./scripts/db-push.sh
COPY --from=builder --chown=nuxtjs:nodejs /app/scripts/entrypoint.sh ./scripts/entrypoint.sh
COPY --from=builder --chown=nuxtjs:nodejs /app/node_modules ./node_modules


RUN mkdir -p /app/public/uploads && \
    chown -R nuxtjs:nodejs /app/public/uploads

RUN chmod +x ./scripts/db-push.sh ./scripts/entrypoint.sh

USER nuxtjs

EXPOSE 3000 8080 8082

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

ENTRYPOINT ["./scripts/entrypoint.sh"]
