# Multi-stage Dockerfile for CodeGraph (Antigravity PythonTutor Visualizer)
# Stage 1: Build Frontend Assets
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package configurations
COPY package*.json ./
COPY client/package*.json ./client/

# Install client dependencies and compile TypeScript React bundle
WORKDIR /app/client
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production Runtime Environment with Multi-Language Compilers
FROM node:20-bookworm-slim AS runner

# Install runtime dependencies for Python, C/C++ GCC, and Java JRE
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    gcc \
    g++ \
    default-jre-headless \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production server dependencies
COPY package*.json ./
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy server code
COPY server/ ./

# Copy built frontend client assets from builder stage
COPY --from=builder /app/client/dist /app/client/dist

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV PYTHON_BIN=python3

EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Start the unified fullstack server
CMD ["node", "server.js"]
