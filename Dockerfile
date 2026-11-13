# syntax=docker/dockerfile:1
# =============================================================================
# Estágio 1 — build do frontend React (web/)
# =============================================================================
FROM oven/bun:latest AS web
WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

# =============================================================================
# Estágio 2 — runtime do app (Hono/Bun) + utilitários de áudio
# =============================================================================
FROM oven/bun:latest
WORKDIR /app

# Ferramenta de extração + ffmpeg (conversão para m4a).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
 && curl -fsSL -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod 755 /usr/local/bin/yt-dlp \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# O app é uma unidade de deploy separada dos microsserviços.
# O .dockerignore exclui auth-service/ e log-service/ (contextos próprios).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .
COPY --from=web /web/dist ./web/dist

ENV NODE_ENV=production
EXPOSE 8222
CMD ["bun", "run", "src/index.ts"]
