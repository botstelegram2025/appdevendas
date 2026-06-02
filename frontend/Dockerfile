# Dockerfile para Frontend Expo Web - BUILD DE PRODUÇÃO
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar package files
COPY package.json yarn.lock ./

# Instalar dependências (sem frozen-lockfile)
RUN yarn install

# Copiar código
COPY . .

# Configurar URL do backend
ENV EXPO_PUBLIC_BACKEND_URL=https://appdevendas-production.up.railway.app
RUN echo "EXPO_PUBLIC_BACKEND_URL=https://appdevendas-production.up.railway.app" > .env

# Build de produção
ENV NODE_ENV=production
RUN npx expo export -p web

# Estágio de produção
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist /app/dist

# SPA routing
RUN echo '{"rewrites":[{"source":"**","destination":"/index.html"}]}' > /app/serve.json

EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
