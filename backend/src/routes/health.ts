import { Router } from 'express';
import { prisma } from '../db';

export const healthRouter = Router();


healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  } catch (err) {
    console.error(err);
  }
});
