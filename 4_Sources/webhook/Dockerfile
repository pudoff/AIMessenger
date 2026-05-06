FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN set -eux; \
    npm ci; \
    npm cache clean --force; \
    rm -rf /root/.npm /root/.npmrc

FROM node:24-alpine

RUN apk add --no-cache docker-cli docker-cli-compose

WORKDIR /app

COPY package*.json ./
COPY entrypoint.sh /entrypoint.sh
COPY . .
COPY --from=builder /app/node_modules ./node_modules/

RUN chmod +x /entrypoint.sh
