# One build, two images:
#   store    the store, run on-prem by compose and on the AWS side by ECS
#   runtime  the console, front door and synthetic traffic
#
# Behind a TLS-inspecting proxy, pass its CA as the optional "extra_ca" build secret.

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    corepack enable && pnpm install --frozen-lockfile && pnpm -r --if-present build

FROM node:22-alpine AS store
WORKDIR /app
COPY --from=build /app /app
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/store/src/server.ts"]

# Postgres' own image, so pg_dump/pg_restore match the databases' major version (16);
# Node is copied in from the official image.
FROM postgres:16-alpine AS runtime
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /usr/lib/libstdc++.so.6* /usr/lib/libgcc_s.so.1 /usr/lib/
WORKDIR /app
COPY --from=build /app /app
ENTRYPOINT []
