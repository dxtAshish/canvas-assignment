# ---------- Stage 1: build the frontend ----------
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --include-workspace-root=false
COPY frontend frontend
RUN npm run build --workspace frontend

# ---------- Stage 2: API server (serves the built frontend) ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache su-exec
COPY package*.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev --include-workspace-root=false
COPY backend backend
COPY --from=frontend-build /app/frontend/dist frontend/dist
RUN mkdir -p backend/uploads && chown -R node:node /app
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
WORKDIR /app/backend
EXPOSE 5000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
