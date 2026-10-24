FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN corepack enable && pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm run prisma:generate && pnpm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3022
CMD ["node", "dist/main.js"]
