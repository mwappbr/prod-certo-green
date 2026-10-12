FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

COPY tsconfig.base.json ./tsconfig.base.json
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY scripts/dev-platform-config.mjs scripts/dev-platform-config.d.mts ./scripts/
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --omit=dev

# Keep these outputs together: server/dist/main.js resolves ../../client/dist.
COPY --from=build --chown=node:node /app/shared/dist ./shared/dist
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/client/dist ./client/dist

# Fastify's configured/default PORT is 3000; Compose maps this container port.
EXPOSE 3000
USER node
CMD ["node", "server/dist/main.js"]
