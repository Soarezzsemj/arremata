import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, validate } from '../lib/http';
import { optionalAuth, requireAuth, requireRole } from '../lib/guards';
import { AppError, badRequest, conflict, forbidden } from '../lib/errors';
import { phaseOf, toSummary, toView } from '../lib/lots';

export const lotsRouter = Router();

const createLotSchema = z
  .object({
    externalSource: z.string().min(1),
    externalId: z.string().min(1),
    title: z.string().trim().min(1),
    imageUrl: z.string().url().nullable().optional(),
    attributes: z.record(z.string(), z.string()),
    startPriceCents: z.number().int().positive(),
    minIncrementCents: z.number().int().min(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'O fim deve ser depois do início.',
    path: ['endsAt'],
  })
  .refine((d) => d.endsAt > new Date(), {
    message: 'O fim deve estar no futuro.',
    path: ['endsAt'],
  });

const listQuerySchema = z.object({
  phase: z.enum(['live', 'scheduled', 'ended']).optional(),
});

function lotNotFound() {
  return new AppError(404, 'LOT_NOT_FOUND', 'Lote não encontrado.');
}


function whereForPhase(
  phase: 'live' | 'scheduled' | 'ended' | undefined,
  now: Date,
): Prisma.LotWhereInput {
  switch (phase) {
    case 'live':
      return { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } };
    case 'scheduled':
      return { status: 'ACTIVE', startsAt: { gt: now } };
    case 'ended':
      return { OR: [{ status: 'SETTLED' }, { status: 'ACTIVE', endsAt: { lte: now } }] };
    default:
      return { status: { not: 'CANCELLED' } }; 
  }
}


lotsRouter.post(
  '/',
  requireAuth,
  requireRole('AUCTIONEER'),
  validate(createLotSchema),
  asyncHandler(async (req, res) => {
    const lot = await prisma.lot.create({
      data: { ...req.body, auctioneerId: req.user!.userId },
    });
    res.status(201).json(toSummary(lot));
  }),
);


lotsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Fase inválida. Use live, scheduled ou ended.');

    const now = new Date();
    const lots = await prisma.lot.findMany({
      where: whereForPhase(parsed.data.phase, now),
      orderBy: { endsAt: 'asc' },
    });
    res.json({ lots: lots.map((l) => toSummary(l, now)), serverTime: now.toISOString() });
  }),
);


lotsRouter.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const lot = await prisma.lot.findUnique({ where: { id } });
    if (!lot) throw lotNotFound();

    const bids = await prisma.bid.findMany({
      where: { lotId: lot.id },
      orderBy: { seq: 'desc' },
      take: 100,
    });
    const now = new Date();
    const viewerId = req.user?.userId ?? null;
    res.json({...toView(lot, bids, viewerId, now),isOwner: viewerId !== null && viewerId === lot.auctioneerId,});
  }),
);


lotsRouter.post(
  '/:id/cancel',
  requireAuth,
  requireRole('AUCTIONEER'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const lot = await prisma.lot.findUnique({ where: { id } });
    if (!lot) throw lotNotFound();
    if (lot.auctioneerId !== req.user!.userId) {
      throw forbidden('Este lote pertence a outro leiloeiro.');
    }

    if (lot.status === 'CANCELLED') return res.json(toSummary(lot));
    if (phaseOf(lot, new Date()) === 'ended') {
      throw conflict('ENDED', 'Este lote já foi encerrado.');
    }
    if (lot.bidCount > 0) {
      throw conflict('LOT_HAS_BIDS', 'Não é possível cancelar um lote que já recebeu lances.');
    }

   
    const result = await prisma.lot.updateMany({
      where: { id: lot.id, status: 'ACTIVE', bidCount: 0 },
      data: { status: 'CANCELLED' },
    });
    if (result.count === 0) {
      throw conflict('LOT_HAS_BIDS', 'O lote recebeu um lance e não pode mais ser cancelado.');
    }

    const updated = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    res.json(toSummary(updated));
  }),
);