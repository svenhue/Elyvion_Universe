FROM node:20-alpine AS build
WORKDIR /workspace
RUN apk add --no-cache openssl && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.base.json
COPY packages/shared-ts/package.json packages/shared-ts/package.json
COPY modules/security-layer/security/package.json modules/security-layer/security/package.json
RUN pnpm install --filter security... --frozen-lockfile

COPY packages/shared-ts packages/shared-ts
COPY modules/security-layer/security modules/security-layer/security
RUN pnpm --filter @elyvion/shared build \
    && pnpm --filter security prisma:generate \
    && pnpm --filter security build

FROM node:20-alpine
WORKDIR /workspace
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /workspace/node_modules node_modules
COPY --from=build /workspace/packages/shared-ts packages/shared-ts
COPY --from=build /workspace/modules/security-layer/security modules/security-layer/security
EXPOSE 3022
CMD ["node", "modules/security-layer/security/dist/main.js"]
