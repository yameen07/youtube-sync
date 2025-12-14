# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy client files
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy built client files from builder
COPY --from=builder /app/client/dist ./client/dist

# Copy server code
COPY server/ ./server/

WORKDIR /app/server

EXPOSE 8080

CMD ["node", "server.js"]

