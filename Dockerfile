# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy client package files
COPY client/package.json client/package-lock.json* ./client/
WORKDIR /app/client
RUN npm install --no-audit --no-fund

# Copy client source and build
WORKDIR /app
COPY client/ ./client/
WORKDIR /app/client
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy server package files first
COPY server/package.json ./server/
COPY server/package-lock.json* ./server/

# Install server dependencies (skip scripts to avoid postinstall build)
WORKDIR /app/server
RUN npm install --only=production --ignore-scripts --no-audit --no-fund

WORKDIR /app

# Copy built client files from builder
COPY --from=builder /app/client/dist ./client/dist

# Copy server code (after dependencies are installed)
COPY server/ ./server/

WORKDIR /app/server

EXPOSE 8080

CMD ["node", "server.js"]

