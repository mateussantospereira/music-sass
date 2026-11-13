FROM oven/bun:latest
WORKDIR /app

# Contexto de build proprio: o auth-service e o app nao fazem parte deste
# servico. Cada microsservico tem seu package.json e seu Dockerfile — e assim
# que se garante que um container nao carrega codigo do outro.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
