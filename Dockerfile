# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build TypeScript (if you build to dist)
RUN npm run build

# Set environment variables (optional, for production)
# ENV NODE_ENV=production

# Start the bot
#CMD ["node", "dist/index.js"]

# Dev mode
CMD ["npx", "ts-node", "src/index.ts"]