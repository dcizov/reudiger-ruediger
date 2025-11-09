FROM node:20-alpine AS builder

WORKDIR /app

RUN apk update && apk upgrade && \
    apk add busybox=1.36.1-r29 && \
    rm -rf /var/cache/apk/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk update && apk upgrade && \
    apk add busybox=1.36.1-r29 && \
    rm -rf /var/cache/apk/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
