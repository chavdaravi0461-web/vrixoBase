# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl

COPY package.json ./
RUN npm install --include=dev

COPY tsconfig.json nest-cli.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine AS production

RUN apk add --no-cache tini curl openssl

RUN addgroup -g 1001 -S vrixo && \
    adduser -S vrixo -u 1001 -G vrixo

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production \
    PORT=4000 \
    NODE_OPTIONS="--max-old-space-size=512" \
    GENERATE_SOURCEMAP=false

USER vrixo

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD sh -c "npx prisma db push --accept-data-loss; node build/main"
