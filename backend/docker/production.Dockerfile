FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY data ./data

RUN npm ci || npm install

EXPOSE 3000 5000
