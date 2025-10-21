# Docker configuration for containerized deployment
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app

# Copy backend
COPY backend/ ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Serve frontend from backend
RUN mkdir -p ./backend/public
RUN cp -r ./frontend/build/* ./backend/public/

WORKDIR /app/backend

EXPOSE 5000

CMD ["node", "server.js"]