# Imagem de desenvolvimento para o Room (TradeClass)
FROM node:22-slim

# Instala pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copia arquivos de gerenciamento do workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/room/package.json ./apps/room/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/world-engine/package.json ./packages/world-engine/
COPY packages/synthetic/package.json ./packages/synthetic/

# Instala todas as dependencias incluindo dev
RUN pnpm install --frozen-lockfile

# Copia codigo fonte
COPY apps/server ./apps/server
COPY apps/room ./apps/room
COPY packages ./packages
COPY scripts/docker-demo-entrypoint.mjs ./scripts/

WORKDIR /app/apps/room

ENTRYPOINT ["node", "/app/scripts/docker-demo-entrypoint.mjs"]
