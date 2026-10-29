import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { emitLotEvent } from '../lib/events';
import { settleCredit, settleDebit } from './wallet';

export async function settleLot(lotId: string) {
  let changed = false;

  const receipt = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Lot" WHERE id = ${lotId} FOR UPDATE
    `;
    if (locked.length === 0) return null;

    const lot = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
    const now = new Date();
    if (lot.status !== 'ACTIVE' || now < lot.endsAt) return null;

    if (lot.bidCount === 0 || !lot.leaderId || lot.currentPriceCents == null) {
      await tx.lot.update({ where: { id: lotId }, data: { status: 'SETTLED' } });
      changed = true;
      return null;
    }
    if (!lot.headHash) {
      throw new Error(`Lote ${lotId} tem lances mas não tem headHash.`);
    }

    const amountCents = lot.currentPriceCents;

    await tx.$queryRaw`
      SELECT id FROM "Wallet"
      WHERE "userId" IN (${Prisma.join([lot.leaderId, lot.auctioneerId])})
      ORDER BY id
      FOR UPDATE
    `;

    await settleDebit(tx, lot.leaderId, lotId, amountCents);
    await settleCredit(tx, lot.auctioneerId, lotId, amountCents);

    const created = await tx.receipt.create({
      data: {
        lotId,
        token: randomBytes(24).toString('base64url'),
        winnerId: lot.leaderId,
        amountCents,
        bidCount: lot.bidCount,
        finalHash: lot.headHash,
      },
    });

    await tx.lot.update({ where: { id: lotId }, data: { status: 'SETTLED' } });
    changed = true;
    return created;
  });

  if (changed) emitLotEvent(lotId, 'settled');
  return receipt;
}

export async function settleDueLots(limit = 50) {
  const due = await prisma.lot.findMany({
    where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
    select: { id: true },
    take: limit,
  });
  for (const { id } of due) {
    try {
      await settleLot(id);
    } catch (err) {
      console.error('Falha ao liquidar o lote', id, err);
    }
  }
  return due.length;
}