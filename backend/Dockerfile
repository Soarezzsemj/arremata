FROM node:22-alpine

# O Prisma precisa do OpenSSL para conectar no Postgres
RUN apk add --no-cache openssl

WORKDIR /app

# Copia só os package*.json primeiro para o Docker reaproveitar o cache do npm ci
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
# Esconde o aviso "atualize o Prisma": a versão 6 é fixada de propósito
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
EXPOSE 3333

# Sincroniza o schema, roda o seed e sobe a API
CMD ["npm", "run", "start:docker"]
