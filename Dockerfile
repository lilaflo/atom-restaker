FROM node:22.17.0-slim AS base
RUN npm install -g pnpm

FROM base AS installer

LABEL fly_launch_runtime="Node.js"

# Install supercronic for cron jobs
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl ca-certificates && \
    curl -fsSLO https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 && \
    echo "cd48d45c4b10f3f0bfdd3a57d054cd05ac96812b  supercronic-linux-amd64" | sha1sum -c - && \
    chmod +x supercronic-linux-amd64 


# Install dotenvx
RUN curl -sfS https://dotenvx.sh/install.sh | sh

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

COPY --from=installer /usr/local/bin/dotenvx /usr/local/bin/dotenvx
COPY --from=installer supercronic-linux-amd64  /usr/local/bin/supercronic
COPY --from=installer /app/package.json ./package.json
COPY --from=installer /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=installer /app/dist ./dist
COPY crontab ./crontab
COPY run-restake.sh ./run-restake.sh
RUN pnpm install --prod

CMD ["/usr/local/bin/supercronic", "/app/crontab"]
