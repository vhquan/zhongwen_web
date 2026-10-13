# syntax=docker/dockerfile:1

FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim AS db
WORKDIR /app
RUN pip install --no-cache-dir pandas openpyxl
COPY scripts ./scripts
COPY resources ./resources
RUN python3 scripts/import_vocab.py

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --prefix server

COPY server/src ./server/src
COPY --from=web /app/web/dist ./web/dist
COPY --from=db /app/data/zhongwen.sqlite ./seed/zhongwen.sqlite
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server/src/index.js"]
