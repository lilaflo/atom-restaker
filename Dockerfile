FROM node:22.17.0-slim AS base
RUN npm install -g pnpm

FROM base AS installer

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

COPY src ./src
COPY jest.config.js ./jest.config.js
COPY package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY tsconfig.json ./tsconfig.json

RUN pnpm install --frozen-lockfile
RUN pnpm test
RUN pnpm build

FROM base AS runner

WORKDIR /app

# Clean up
RUN rm -rf /opt/yarn /tmp/*

COPY --from=installer /app/package.json ./package.json
COPY --from=installer /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=installer /app/dist ./dist
RUN pnpm install --prod

EXPOSE 8080
CMD ["node", "dist/server.js"]
