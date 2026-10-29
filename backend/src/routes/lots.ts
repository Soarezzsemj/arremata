import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { asyncHandler, validate } from '../lib/http';
import { optionalAuth, requireAuth, requireRole } from '../lib/guards';
import { AppError, badRequest, conflict, forbidden } from '../lib/errors';
import { phaseOf, toSummary, toView } from '../lib/lots';
import { placeBid } from '../services/bids';
import { settleLot } from '../services/settlement';

export const lotsRouter = Router();

//p nao bugar o postgres
const MAX_CENTS = 1_000_000_000;


const ARTIC_IMAGE_PREFIX = 'https://www.artic.edu/iiif/';


const LIST_LIMIT = 50;

const createLotSchema = z
  .object({
    externalSource: z.literal('artic'),
    externalId: z.string().trim().min(1).max(40),
    title: z.string().trim().min(1).max(300),
    imageUrl: z.string().max(500).startsWith(ARTIC_IMAGE_PREFIX).nullable().optional(),
    attributes: z.record(z.string().max(100), z.string().max(300)),
    startPriceCents: z.number().int().positive().max(MAX_CENTS),
    minIncrementCents: z.number().int().min(1).max(MAX_CENTS),
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

//criar lote, apenas leileiro consegue 
lotsRouter.post(
  '/',
  requireAuth,
  requireRole('AUCTIONEER'),
  validate(createLotSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    const lot = await prisma.lot.create({
      data: {
        auctioneerId: req.user!.userId,
        externalSource: body.externalSource,
        externalId: body.externalId,
        title: body.title,
        imageUrl: body.imageUrl,
        attributes: body.attributes,
        startPriceCents: body.startPriceCents,
        minIncrementCents: body.minIncrementCents,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
      },
    });
    res.status(201).json(toSummary(lot));
  }),
);


lotsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Fase inválida. Use live, scheduled ou ended.');
    const phase = parsed.data.phase;

    const now = new Date();
    const lots = await prisma.lot.findMany({
      where: whereForPhase(phase, now),
      orderBy: { endsAt: phase === 'ended' ? 'desc' : 'asc' },
      take: LIST_LIMIT,
    });
    res.json({ lots: lots.map((l) => toSummary(l, now)), serverTime: now.toISOString() });
  }),
);


lotsRouter.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);

    let lot = await prisma.lot.findUnique({ where: { id } });
    if (!lot) throw lotNotFound();
    if (lot.status === 'ACTIVE' && lot.endsAt <= new Date()) {
      await settleLot(lot.id);
      lot = await prisma.lot.findUniqueOrThrow({ where: { id } });
    }

    const bids = await prisma.bid.findMany({
      where: { lotId: lot.id },
      orderBy: { seq: 'desc' },
      take: 100,
    });

    const receipt =
      lot.status === 'SETTLED'
        ? await prisma.receipt.findUnique({ where: { lotId: lot.id } })
        : null;

    const now = new Date();
    const viewerId = req.user?.userId ?? null;

    res.json({
      ...toView(lot, bids, viewerId, now, receipt),
      isOwner: viewerId !== null && viewerId === lot.auctioneerId,
    });
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



const bidSchema = z.object({
  amountCents: z.number().int().min(1).max(MAX_CENTS),
});

lotsRouter.post(
  '/:id/bids',
  requireAuth,
  requireRole('BIDDER'),
  validate(bidSchema),
  asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const result = await placeBid(id, req.user!.userId, req.body.amountCents);
  res.status(201).json(result);
}),
);