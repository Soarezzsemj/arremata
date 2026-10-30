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
import { emitLotEvent, onLotEvent } from '../lib/events';
import { bidLimiter } from '../lib/rateLimit';
import { cancelLot } from '../services/cancel';


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

const PRICE_SORT_CAP = 1000;

const listQuerySchema = z.object({
  phase: z.enum(['live', 'scheduled', 'ended']).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['ending', 'newest', 'bids', 'price_asc', 'price_desc']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT).default(LIST_LIMIT),
});

function orderByFor(
  sort: string | undefined,
  phase: string | undefined,
): Prisma.LotOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    case 'bids':
      return [{ bidCount: 'desc' }, { endsAt: 'asc' }, { id: 'asc' }];
    default:
      return [{ endsAt: phase === 'ended' ? 'desc' : 'asc' }, { id: 'asc' }];
  }
}

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
    if (!parsed.success) {
      throw badRequest(
        'Parâmetros inválidos. Use phase (live, scheduled, ended), q (até 100 caracteres), ' +
          'sort (ending, newest, bids, price_asc, price_desc), page e limit (1 a 50).',
      );
    }
    const { phase, sort, page, limit } = parsed.data;
    const q = parsed.data.q || undefined;

    const now = new Date();
    const phaseWhere = whereForPhase(phase, now);
    const where: Prisma.LotWhereInput = q
      ? { AND: [phaseWhere, { title: { contains: q, mode: 'insensitive' } }] }
      : phaseWhere;
    const skip = (page - 1) * limit;

    const total = await prisma.lot.count({ where });
    let lots;

    if (sort === 'price_asc' || sort === 'price_desc') {
      const rows = await prisma.lot.findMany({
        where,
        select: { id: true, startPriceCents: true, currentPriceCents: true },
        take: PRICE_SORT_CAP,
      });
      const dir = sort === 'price_asc' ? 1 : -1;
      const price = (r: (typeof rows)[number]) => r.currentPriceCents ?? r.startPriceCents;
      rows.sort((a, b) => dir * (price(a) - price(b)) || a.id.localeCompare(b.id));

      const ids = rows.slice(skip, skip + limit).map((r) => r.id);
      const found = await prisma.lot.findMany({ where: { id: { in: ids } } });
      const byId = new Map(found.map((l) => [l.id, l]));
      lots = ids.map((id) => byId.get(id)).filter((l): l is NonNullable<typeof l> => !!l);
    } else {
      lots = await prisma.lot.findMany({
        where,
        orderBy: orderByFor(sort, phase),
        skip,
        take: limit,
      });
    }

    res.json({
      lots: lots.map((l) => toSummary(l, now)),
      serverTime: now.toISOString(),
      total,
      page,
      pageSize: limit,
      hasMore: skip + lots.length < total,
    });
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
    const { lot, refundedCents } = await cancelLot(id, req.user!.userId);
    if (refundedCents > 0) emitLotEvent(id, 'settled');
    res.json({ ...toSummary(lot), refundedCents });
  }),
);


const bidSchema = z.object({
  amountCents: z.number().int().min(1).max(MAX_CENTS),
});

lotsRouter.post(
  '/:id/bids',
  requireAuth,
  requireRole('BIDDER'),
  bidLimiter,
  validate(bidSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await placeBid(id, req.user!.userId, req.body.amountCents);
    emitLotEvent(id, 'bid');
    res.status(201).json(result);
  }),
);

lotsRouter.get(
  '/:id/events',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const exists = await prisma.lot.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw lotNotFound();

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');

    const off = onLotEvent(id, (type) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify({ lotId: id })}\n\n`);
    });
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      off();
    });
  }),
);