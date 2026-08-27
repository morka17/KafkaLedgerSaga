# syntax=docker/dockerfile:1
#
# The "migrator" image - deliberately NOT a slim per-service runtime
# image like apps/*/Dockerfile. tools/migration-runner/run-all-migrations.ts
# spawns `npm run migration:run` inside EACH app's own directory, which
# runs `typeorm-ts-node-commonjs` against that app's TypeScript source
# directly (see any apps/*/package.json's migration:run script) - it
# needs ts-node and every app's full source tree present, not a compiled
# dist/ folder. So this image is close to the whole monorepo, not a
# single service's slim build output.
FROM node:20-alpine
WORKDIR /workspace

COPY package.json package-lock.json* tsconfig.base.json nx.json ./
COPY libs ./libs
COPY apps ./apps
COPY tools ./tools

RUN npm install --workspaces --include-workspace-root

ENTRYPOINT ["npm", "run", "--workspace=@saganova/tools", "migrate:run-all"]
