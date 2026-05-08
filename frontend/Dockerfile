# Dockerfile para Frontend Expo Web no Railway
FROM node:20-alpine

# Instalar dependências necessárias
RUN apk add --no-cache python3 make g++

# Definir diretório de trabalho
WORKDIR /workspace

# Copiar TUDO do repositório primeiro
COPY . .

# Entrar na pasta frontend
WORKDIR /workspace/frontend

# Instalar dependências
RUN yarn install --frozen-lockfile

# Build para produção web
RUN npx expo export -p web

# Instalar servidor estático
RUN npm install -g serve

# Expor porta
EXPOSE 3000

# Servir os arquivos estáticos gerados
CMD ["serve", "-s", "dist", "-l", "3000"]
