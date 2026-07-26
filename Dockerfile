FROM oven/bun:1.2-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.2-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 8080
CMD ["bun", "run", "dist/index.js"]
