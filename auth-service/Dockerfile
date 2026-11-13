FROM oven/bun:latest
WORKDIR /app

# Contexto de build proprio: apenas este microsservico entra na imagem.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
