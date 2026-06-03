# Medullo frontend — Next.js 14 (App Router) in standalone mode.
#
# Build: docker build -t medullo-frontend ./frontend
# Run:   docker run -p 3000:3000 \
#          -e NEXT_PUBLIC_API_URL=https://your-backend.example.com \
#          medullo-frontend
#
# Vercel deploys can ignore this Dockerfile — they use their own pipeline.
# This is here so the docker-compose self-host story works without it.

# ---- Build stage --------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* env vars are baked at build time. Self-hosters can override
# at build (--build-arg) or rebuild against their own backend URL.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

# ---- Runtime stage ------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user for runtime.
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
