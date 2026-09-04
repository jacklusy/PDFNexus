# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --workspace=@pdfnexus/web --workspace=@pdfnexus/shared --include-workspace-root=false

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# NEXT_PUBLIC_* values are inlined into the bundle by `next build`, so they must
# be present HERE. Supplying them only at runtime (env_file) leaves canonical
# URLs, OG tags, and sitemap.xml pointing at seo.ts's fallback domain.
# Declared after the COPYs so changing a URL rebuilds only this layer.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STORAGE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STORAGE_URL=$NEXT_PUBLIC_STORAGE_URL

# BUILD_TIME feeds sitemap.xml's <lastmod>; captured at build so it reflects a
# real build instead of a hardcoded date that silently goes stale.
RUN export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  && npm run build -w @pdfnexus/shared \
  && npm run build -w @pdfnexus/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
