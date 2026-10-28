import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate } from '../lib/http';
import { requireAuth, requireRole } from '../lib/guards';
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