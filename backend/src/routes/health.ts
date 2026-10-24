import { Router } from 'express';
import { prisma } from '../db';

export const healthRouter = Router();

// Usada pelo Docker, pelo Render e pelo teste de fumaça do CD.
// Faz um SELECT 1 para garantir que a API também consegue falar com o banco.
healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  } catch {
    res.status(503).json({
      error: { code: 'INTERNAL', message: 'Banco de dados indisponível' },
    });
  }
});
