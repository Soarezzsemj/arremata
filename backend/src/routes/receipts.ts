import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../lib/http';
import { AppError } from '../lib/errors';
import { pseudonym } from '../lib/pseudonym';

export const receiptsRouter = Router();


receiptsRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const token = String(req.params.token).slice(0, 64);
    const receipt = await prisma.receipt.findUnique({
      where: { token },
      include: { lot: true },
    });
    if (!receipt) {
      throw new AppError(404, 'RECEIPT_NOT_FOUND', 'Comprovante não encontrado.');
    }

    const { lot } = receipt;
    res.json({
      lotId: lot.id,
      title: lot.title,
      imageUrl: lot.imageUrl,
      attributes: lot.attributes,
      winner: pseudonym(lot.id, receipt.winnerId),
      amountCents: receipt.amountCents,
      bidCount: receipt.bidCount,
      finalHash: receipt.finalHash,
      issuedAt: receipt.issuedAt.toISOString(),
    });
  }),
);