FROM node:20-alpine AS build
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.base.json
COPY packages/shared-ts/package.json packages/shared-ts/package.json
COPY modules/security-layer/auth/package.json modules/security-layer/auth/package.json
RUN pnpm install --filter auth... --frozen-lockfile

COPY packages/shared-ts packages/shared-ts
COPY modules/security-layer/auth modules/security-layer/auth
RUN pnpm --filter @elyvion/shared build \
    && pnpm --filter auth build

FROM node:20-alpine
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules node_modules
COPY --from=build /workspace/packages/shared-ts packages/shared-ts
COPY --from=build /workspace/modules/security-layer/auth modules/security-layer/auth
EXPOSE 3011
CMD ["node", "modules/security-layer/auth/dist/main.js"]
