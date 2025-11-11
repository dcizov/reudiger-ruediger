FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder

COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts

COPY tsup.config.ts tsconfig.json ./
COPY src ./src

RUN npx tsup

FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts

FROM base AS development
ENV NODE_ENV=development

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

CMD ["npm", "run", "dev"]

FROM base AS production

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nodejs:nodejs /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.bin/drizzle-kit ./node_modules/.bin/drizzle-kit

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

COPY --chown=nodejs:nodejs drizzle ./drizzle
COPY --chown=nodejs:nodejs drizzle.config.ts ./

USER nodejs
EXPOSE 3000

CMD ["node", "dist/index.js"]