# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json* tsconfig.base.json nx.json ./
COPY libs ./libs
COPY apps/audit-ledger-service ./apps/audit-ledger-service

RUN npm install --workspaces --include-workspace-root
RUN npx tsc -p apps/audit-ledger-service/tsconfig.app.json

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/dist/apps/audit-ledger-service ./
COPY --from=builder /workspace/node_modules ./node_modules
COPY apps/audit-ledger-service/package.json ./

EXPOSE 3005
USER node
CMD ["node", "main.js"]
