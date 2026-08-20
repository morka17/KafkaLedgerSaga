# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json* tsconfig.base.json nx.json ./
COPY libs ./libs
COPY apps/api-gateway ./apps/api-gateway

RUN npm install --workspaces --include-workspace-root
RUN npx tsc -p apps/api-gateway/tsconfig.app.json

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/dist/apps/api-gateway ./
COPY --from=builder /workspace/node_modules ./node_modules
COPY apps/api-gateway/package.json ./

EXPOSE 3000
USER node
CMD ["node", "main.js"]
