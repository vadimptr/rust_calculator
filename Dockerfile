# Build stage
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# API dependencies
FROM --platform=$BUILDPLATFORM node:24-alpine AS api-deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# API stage
FROM node:24-alpine AS api

WORKDIR /app

COPY package.json ./
COPY --from=api-deps /app/node_modules ./node_modules
COPY src ./src
COPY docs/blueprint ./docs/blueprint
COPY server ./server

ENV PORT=3001 DB_PATH=/data/schemes.db NODE_ENV=production
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 3001
USER node
CMD ["node", "server/index.ts"]

# Serve stage
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
