# --- Étape 1 : dépendances (compile bcrypt etc.) ---
FROM node:20-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# --- Étape 2 : image finale ---
FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY schema.sql ./
COPY src ./src
COPY public ./public
COPY views ./views

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
CMD ["node", "src/server.js"]
