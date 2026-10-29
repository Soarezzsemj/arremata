import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AppError, conflict, notFound } from '../lib/errors';
import { computeBidHash, genesisHash } from '../lib/chain';
import { holdFunds, releaseFunds } from './wallet';

const SNIPING_WINDOW_MS = 2 * 60 * 1000;

export async function placeBid(lotId: string, userId: string, amountCents: number) {
  return prisma.$transaction(async (tx) => {
    
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Lot" WHERE id = ${lotId} FOR UPDATE
    `;
    if (locked.length === 0) throw notFound('Lote não encontrado.');

    const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
    const now = new Date(); 

    
    if (lot.status === 'CANCELLED') {
      throw conflict('LOT_CANCELLED', 'Este lote foi cancelado.');
    }
    if (lot.status === 'SETTLED' || now >= lot.endsAt) {
      throw conflict('ENDED', 'Este leilão já encerrou.');
    }
    if (now < lot.startsAt) {
      throw conflict('NOT_STARTED', 'Este leilão ainda não começou.');
    }
    if (lot.leaderId === userId) {
      throw conflict('ALREADY_LEADING', 'Você já está liderando este lote.');
    }

    const minCents =
      lot.bidCount === 0
        ? lot.startPriceCents
        : (lot.currentPriceCents ?? lot.startPriceCents) + lot.minIncrementCents;
    if (amountCents < minCents) {
      throw new AppError(409, 'BELOW_MIN', 'Lance abaixo do mínimo.', { minCents });
    }

  
    const prevLeaderId = lot.leaderId;
    const userIds = prevLeaderId ? [userId, prevLeaderId] : [userId];
    await tx.$queryRaw`
      SELECT id FROM "Wallet"
      WHERE "userId" IN (${Prisma.join(userIds)})
      ORDER BY id
      FOR UPDATE`;

    await holdFunds(tx, userId, lotId, amountCents);

    if (prevLeaderId && lot.currentPriceCents != null) {
      await releaseFunds(tx, prevLeaderId, lotId, lot.currentPriceCents);
    }

    
    const seq = lot.bidCount + 1;
    const prevHash = lot.headHash ?? genesisHash(lotId);
    const hash = computeBidHash(prevHash, lotId, seq, userId, amountCents, now.getTime());

    const bid = await tx.bid.create({
      data: { lotId, bidderId: userId, seq, amountCents, prevHash, hash, createdAt: now },
    });

    //anti sniping
    const extended = lot.endsAt.getTime() - now.getTime() <= SNIPING_WINDOW_MS;
    const newEndsAt = extended ? new Date(now.getTime() + SNIPING_WINDOW_MS) : lot.endsAt;

    const updated = await tx.lot.update({
      where: { id: lotId },
      data: {
        currentPriceCents: amountCents,
        bidCount: seq,
        headHash: hash,
        leaderId: userId,
        endsAt: newEndsAt,
      },
    });

    return {
      bid: { seq: bid.seq, amountCents: bid.amountCents, createdAt: bid.createdAt },
      lot: {
        id: updated.id,
        currentPriceCents: updated.currentPriceCents,
        bidCount: updated.bidCount,
        endsAt: updated.endsAt,
      },
      extended,
    };
  });
}