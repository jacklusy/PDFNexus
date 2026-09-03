# Multi-stage NestJS API build for PDFNexus
FROM node:20-alpine AS deps
WORKDIR /app

# Workspace root context (docker-compose build context is repo root)
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=@pdfnexus/api --workspace=@pdfnexus/shared --include-workspace-root=false

FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build -w @pdfnexus/shared \
  && npm run prisma:generate -w @pdfnexus/api \
  && npm run build -w @pdfnexus/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=4000

RUN addgroup -S pdfnexus && adduser -S pdfnexus -G pdfnexus

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

USER pdfnexus
WORKDIR /app/apps/api
EXPOSE 4000

CMD ["node", "dist/main.js"]
