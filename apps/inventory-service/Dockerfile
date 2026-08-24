# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /workspace
COPY package.json package-lock.json* tsconfig.base.json nx.json ./
COPY libs ./libs
COPY apps/inventory-service ./apps/inventory-service
RUN npm install --workspaces --include-workspace-root
RUN npx tsc -p apps/inventory-service/tsconfig.app.json

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /workspace/dist/apps/inventory-service ./
COPY --from=builder /workspace/node_modules ./node_modules
COPY apps/inventory-service/package.json ./
EXPOSE 3003
USER node
CMD ["node", "main.js"]
