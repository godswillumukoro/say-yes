# Cloud Run-ready Dockerfile for say-yes (Node + Express + Socket.IO)
# Notes:
# - Uses Node 20 Alpine.
# - Creates an empty /app/assets dir at build time. Runtime writes are ephemeral on Cloud Run.
# - The service must listen on PORT, which Cloud Run injects (we default to 8080 here).

FROM node:20-alpine

# Create non-root user for security (optional but recommended)
RUN addgroup -S nodegrp && adduser -S nodeusr -G nodegrp

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source (keep image small; copy only what we need)
COPY server.js ./
COPY public ./public

# Ensure runtime directories exist
RUN mkdir -p assets db \
  && chown -R nodeusr:nodegrp /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER nodeusr

CMD ["node", "server.js"]
