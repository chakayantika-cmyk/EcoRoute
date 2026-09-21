# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/validation/package.json packages/validation/
COPY packages/config/package.json packages/config/
COPY apps/web/package.json apps/web/

RUN npm install --workspace=apps/web --workspace=packages/shared-types --workspace=packages/validation --workspace=packages/config

COPY packages/ packages/
COPY apps/web/ apps/web/
COPY tsconfig.base.json ./

RUN cd apps/web && npx vite build

# ---- Runtime Stage ----
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
