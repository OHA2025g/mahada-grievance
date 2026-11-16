FROM node:24-bookworm-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=1 \
    WRANGLER_SEND_METRICS=false \
    CLOUDFLARE_CF_FETCH_ENABLED=false

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.25.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile \
  && node tools/prepare-local.mjs \
  && pnpm run build \
  && node tools/migrate-local.mjs

EXPOSE 8080

CMD ["node", "scripts/docker-entrypoint.mjs"]
