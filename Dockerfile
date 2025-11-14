FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache bash

FROM base AS development
ENV NODE_ENV=development

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

CMD ["npm", "run", "dev"]

FROM base AS deps

COPY package.json package-lock.json ./

ENV CI=true
RUN npm ci --omit=dev --ignore-scripts

FROM base AS builder

COPY package.json package-lock.json ./

RUN npm ci

COPY src ./src
COPY drizzle ./drizzle
COPY drizzle.config.ts tsconfig.json ./

RUN npm run build

FROM base AS production

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs drizzle ./drizzle
COPY --chown=nodejs:nodejs package.json ./

ENV NODE_ENV=production

USER nodejs
EXPOSE 3000

CMD ["node", "dist/index.js"]
