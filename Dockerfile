FROM node:20-alpine AS base

# Install build dependencies for better-sqlite3 native module.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install dependencies.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Remove build dependencies to reduce image size.
RUN apk del python3 make g++

# Copy application source.
COPY src/ ./src/
COPY database/.gitkeep ./database/

# Create a non-root user for security.
RUN addgroup -S casino && adduser -S casino -G casino
RUN chown -R casino:casino /app
USER casino

# Health check: verify the process is running.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"

EXPOSE 3000

CMD ["node", "src/index.js"]
