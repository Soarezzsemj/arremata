# Arremata

Casa de leilões online feita para o teste técnico Elite Dev da Verzel. Um leiloeiro cria lotes a partir de obras de arte da API pública do Art Institute of Chicago, e licitantes dão lances ao vivo com saldo simulado. O histórico de lances pode ser auditado publicamente.

## Stack

- **Backend:** Node 22, Express, TypeScript, Prisma 6, PostgreSQL, Zod, Vitest
- **Frontend:** Vite, React, TypeScript, Tailwind CSS v4, React Router, TanStack Query
- **Infra:** Docker Compose, GitHub Actions, Render (API e banco) e Vercel (front)

## Rodando com Docker (recomendado)

Pré-requisito: [Docker](https://www.docker.com/) com Docker Compose.

```bash
cp .env.example .env    # opcional: sem .env o compose usa valores padrão de desenvolvimento
docker compose up --build
```

Abra http://localhost:8080. A página deve mostrar **"API no ar"**.

O compose sobe três containers:

| Serviço | O que é | Porta |
| --- | --- | --- |
| `db` | PostgreSQL 16 | 5432 |
| `api` | API Express (cria as tabelas e roda o seed ao subir) | interna (3333) |
| `web` | Front servido pelo nginx, que repassa `/api` para a API | 8080 |

Para parar: `docker compose down`. Para apagar também os dados do banco: `docker compose down -v`.

## Rodando sem Docker

Pré-requisitos: Node 22 e um PostgreSQL. O jeito mais fácil de ter o banco é subir só ele pelo compose: `docker compose up db`.

**Backend** (porta 3333):

```bash
cd backend
cp .env.example .env     # ajuste o DATABASE_URL se o seu Postgres for outro
npm install
npx prisma generate      # gera o Prisma Client
npx prisma db push       # cria as tabelas no banco
npm run seed             # dados de demonstração
npm run dev
```

**Frontend** (porta 5173), em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. O Vite repassa as chamadas `/api` para http://localhost:3333.

## Testes

```bash
cd backend
npx prisma generate      # uma vez, se ainda não rodou
npm test                 # testes que não precisam de banco
```

Para rodar também os testes que usam banco (como o CI faz), com o Postgres no ar e o `DATABASE_URL` configurado:

```bash
RUN_DB_TESTS=1 npm test
```

Verificação de tipos: `npm run typecheck` (no `backend/` e no `frontend/`).

## Scripts do backend

| Script | O que faz |
| --- | --- |
| `npm run dev` | API em modo desenvolvimento, reiniciando a cada alteração |
| `npm run build` | Gera o Prisma Client e compila para `dist/` |
| `npm start` | Roda a versão compilada |
| `npm run start:docker` | Sincroniza o schema, roda o seed e sobe a API (usado no Docker e no Render) |
| `npm run typecheck` | Confere os tipos sem gerar arquivos |
| `npm test` | Roda os testes com Vitest |
| `npm run seed` / `npm run seed:reset` | Cria os dados de demonstração / apaga e recria |

## Estrutura de pastas

```
arremata/
├── backend/            API (Express + Prisma)
│   ├── prisma/         schema.prisma e seed
│   ├── src/
│   │   ├── lib/        funções utilitárias
│   │   ├── routes/     rotas do Express
│   │   ├── services/   regras de negócio
│   │   ├── app.ts      configuração do Express
│   │   ├── config.ts   leitura das variáveis de ambiente
│   │   ├── db.ts       Prisma Client
│   │   └── server.ts   sobe o servidor
│   └── test/           testes (Vitest)
├── frontend/           SPA React (Vite)
│   └── src/
│       ├── components/
│       ├── lib/        cliente da API e tema
│       └── pages/
├── docs/               documentação
├── .github/workflows/  CI e CD
├── docker-compose.yml
└── render.yaml         blueprint do deploy no Render
```

## Documentação

- [Requisitos do teste](docs/REQUISITOS.md): o enunciado organizado.
- [Guia do projeto](docs/GUIA_DO_PROJETO.md): decisões técnicas, endpoints, modelo de dados e regras.
- [CI/CD](docs/CICD.md): passo a passo para configurar GitHub, Render e Vercel.
