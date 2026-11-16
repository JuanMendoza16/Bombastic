# Imagen del juego completo (web + API + partidas online).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production \
    PORT=8123 \
    DB_PATH=/app/data/bomberman.db
EXPOSE 8123
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8123/api/health || exit 1
CMD ["npm", "start"]
