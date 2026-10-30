import { Router } from 'express';
import { prisma } from '../db';

export const healthRouter = Router();

const DB_TIMEOUT_MS = 3_000;

healthRouter.get('/health', async (_req, res) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
  });

  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  } catch {
    console.error('Health check: banco fora do ar ou lento');
    res.status(503).json({ status: 'degraded', db: 'down' });
  } finally {
    clearTimeout(timer);
  }
});
