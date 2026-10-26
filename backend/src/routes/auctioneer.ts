import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http';
import { requireAuth, requireRole } from '../lib/guards';
import { badRequest } from '../lib/errors';
import { searchArtworks } from '../services/external';

export const auctioneerRouter = Router();

const searchQuery = z.object({ q: z.string().trim().min(2).max(100) });

auctioneerRouter.get(
  '/search',
  requireAuth,
  requireRole('AUCTIONEER'),
  asyncHandler(async (req, res) => {
    const parsed = searchQuery.safeParse(req.query);
    if (!parsed.success) throw badRequest('Informe ao menos 2 letras para buscar.');

    const items = await searchArtworks(parsed.data.q);
    res.json({ items });
  }),
);