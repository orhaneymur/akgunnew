# syntax=docker/dockerfile:1

# ── Bağımlılıklar, Prisma Client & TypeScript derleme ─────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY src ./src

# PascalCase schema zorunlu — eski introspect schema ile build patlar
RUN grep -q "model ProductStock" prisma/schema.prisma || (echo "HATA: git pull origin orhan — schema.prisma guncel degil" && exit 1)

RUN npx prisma generate
RUN npx tsc -p tsconfig.build.json

# ── Production imajı ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Canlı DB'de db push kullanmayın — migration'lar import/migrate ile bir kez uygulanır
CMD ["node", "dist/index.js"]