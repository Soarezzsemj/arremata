import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../lib/http';
import { AppError } from '../lib/errors';
import { genesisHash, verifyChain } from '../lib/chain';
import { phaseOf } from '../lib/lots';
import { pseudonym } from '../lib/pseudonym';

export const auditRouter = Router();


auditRouter.get(
  '/:lotId',
  asyncHandler(async (req, res) => {
    const id = String(req.params.lotId);
    const lot = await prisma.lot.findUnique({ where: { id }, include: { receipt: true } });
    if (!lot) throw new AppError(404, 'LOT_NOT_FOUND', 'Lote não encontrado.');

    const bids = await prisma.bid.findMany({
      where: { lotId: id },
      orderBy: { seq: 'asc' },
      take: 5000,
    });

    const issues = verifyChain(bids, lot, lot.receipt ?? undefined);

    res.json({
      lotId: lot.id,
      title: lot.title,
      phase: phaseOf(lot, new Date()),
      bidCount: lot.bidCount,
      genesisHash: genesisHash(lot.id),
      headHash: lot.headHash,
      finalHash: lot.receipt?.finalHash ?? null,
      verification: {
        ok: issues.length === 0,
        issues: issues.map((i) => ({ code: i.code, seq: i.seq ?? null, message: i.message })),
      },
      bids: bids.map((b) => ({
        seq: b.seq,
        bidder: pseudonym(lot.id, b.bidderId), 
        amountCents: b.amountCents,
        at: b.createdAt.toISOString(),
        prevHash: b.prevHash,
        hash: b.hash,
      })),
    });
  }),
);