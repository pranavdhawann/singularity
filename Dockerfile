FROM node:24-bookworm-slim

# Toolchain fallback for native modules (better-sqlite3) if no prebuild matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile

ENV FUTURE_HOST=0.0.0.0
ENV FUTURE_WEB_HOST=0.0.0.0
EXPOSE 4173 4174

CMD ["corepack", "pnpm", "demo"]
