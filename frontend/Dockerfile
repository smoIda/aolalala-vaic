# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Build the Next.js app.
# NEXT_PUBLIC_* are inlined at build time, so the backend URL must be known
# here. docker-compose passes it as a build arg (see docker-compose.vps.yml).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output already contains a minimal server + only the node_modules
# it actually needs. public/ and .next/static are not copied by standalone, so
# we add them manually (server.js serves them when present).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
