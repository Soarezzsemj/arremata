import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler } from '../lib/http';
import { requireAuth, requireRole } from '../lib/guards';
import { badRequest } from '../lib/errors';
import { toSummary } from '../lib/lots';
import { pseudonym } from '../lib/pseudonym';
import { searchArtworks } from '../services/external';
import { searchLimiter } from '../lib/rateLimit';

export const auctioneerRouter = Router();

const searchQuery = z.object({ q: z.string().trim().min(2).max(100) });

auctioneerRouter.get(
  '/search',
  requireAuth,
  requireRole('AUCTIONEER'),
  searchLimiter,
  asyncHandler(async (req, res) => {
    const parsed = searchQuery.safeParse(req.query);
    if (!parsed.success) throw badRequest('Informe ao menos 2 letras para buscar.');

    const items = await searchArtworks(parsed.data.q);
    res.json({ items });
  }),
);

auctioneerRouter.get(
  '/lots',
  requireAuth,
  requireRole('AUCTIONEER'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const lots = await prisma.lot.findMany({
      where: { auctioneerId: req.user!.userId },
      include: { receipt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      lots: lots.map((lot) => ({
        ...toSummary(lot, now),
        result: lot.receipt
          ? {
              outcome: 'sold' as const,
              amountCents: lot.receipt.amountCents,
              winner: pseudonym(lot.id, lot.receipt.winnerId),
              receiptToken: lot.receipt.token,
            }
          : lot.status === 'SETTLED'
            ? { outcome: 'unsold' as const }
            : null,
      })),
      serverTime: now.toISOString(),
    });
  }),
);