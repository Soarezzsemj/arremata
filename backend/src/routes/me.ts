import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, validate } from '../lib/http';
import { requireAuth, requireRole } from '../lib/guards';
import { phaseOf, toSummary } from '../lib/lots';
import { deposit, getWallet } from '../services/wallet';


export const meRouter = Router();


const depositSchema = z.object({
    amountCents: z.number().int().min(100).max(10_000_000),
})

meRouter.get('/wallet',requireAuth,asyncHandler(async (req, res) => {
    res.json(await getWallet(req.user!.userId));
}),
);


meRouter.post('/wallet/deposit',requireAuth,requireRole('BIDDER'),validate(depositSchema),asyncHandler(async (req, res) => {
    res.status(201).json(await deposit(req.user!.userId, req.body.amountCents));
  }),
);


meRouter.get(
  '/bids',
  requireAuth,
  requireRole('BIDDER'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const now = new Date();

    const lots = await prisma.lot.findMany({
      where: { bids: { some: { bidderId: userId } } },
      include: {
        bids: { where: { bidderId: userId }, orderBy: { seq: 'desc' }, take: 1 },
        receipt: true,
      },
      orderBy: { endsAt: 'desc' },
      take: 100,
    });

    res.json({
      lots: lots.map((lot) => {
        const ended = phaseOf(lot, now) === 'ended';
        const isLeader = lot.leaderId === userId;
        const standing = ended
          ? isLeader ? 'won' : 'lost'
          : isLeader ? 'leading' : 'outbid';
        return {
          ...toSummary(lot, now),
          myLastBidCents: lot.bids[0]?.amountCents ?? null,
          standing,
          receiptToken: standing === 'won' ? (lot.receipt?.token ?? null) : null,
        };
      }),
      serverTime: now.toISOString(),
    });
  }),
);