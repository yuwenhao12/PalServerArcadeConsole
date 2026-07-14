FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ARG APT_MIRROR=
RUN if [ -n "$APT_MIRROR" ]; then sed -i "s|http://deb.debian.org/debian|${APT_MIRROR%/}|g; s|http://deb.debian.org/debian-security|${APT_MIRROR%/}-security|g" /etc/apt/sources.list.d/debian.sources; fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates docker.io python3 python3-pip \
  && pip3 install --no-cache-dir --retries 5 --timeout 60 --break-system-packages loguru orjson pyooz==0.0.8 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/config /app/data

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/vendor ./vendor

EXPOSE 3000
CMD ["node", "server.js"]
