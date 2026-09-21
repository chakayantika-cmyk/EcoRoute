# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/validation/package.json packages/validation/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
COPY prisma/ prisma/

RUN npm install --workspace=apps/api --workspace=packages/shared-types --workspace=packages/validation --workspace=packages/config

COPY packages/ packages/
COPY apps/api/ apps/api/
COPY prisma/ prisma/
COPY tsconfig.base.json ./

RUN npx prisma generate --schema=prisma/schema.prisma
RUN cd apps/api && npx tsc

# ---- Runtime Stage ----
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && npx tsx prisma/seed.ts && node apps/api/dist/server.js"]

EXPOSE 3001
