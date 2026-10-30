import { prisma } from '../db';
import { AppError, conflict, forbidden } from '../lib/errors';
import { phaseOf } from '../lib/lots';
import { releaseFunds } from './wallet';


export async function cancelLot(lotId: string, auctioneerId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Lot" WHERE id = ${lotId} FOR UPDATE`;

    const lot = await tx.lot.findUnique({ where: { id: lotId } });
    if (!lot) throw new AppError(404, 'LOT_NOT_FOUND', 'Lote não encontrado.');
    if (lot.auctioneerId !== auctioneerId) {
      throw forbidden('Este lote pertence a outro leiloeiro.');
    }


    if (lot.status === 'CANCELLED') return { lot, refundedCents: 0 };

    if (phaseOf(lot, new Date()) === 'ended') {
      throw conflict('ENDED', 'Este lote já foi encerrado.');
    }

    let refundedCents = 0;
    if (lot.leaderId && lot.currentPriceCents !== null) {
      await releaseFunds(tx, lot.leaderId, lot.id, lot.currentPriceCents);
      refundedCents = lot.currentPriceCents;
    }

    const updated = await tx.lot.update({
      where: { id: lot.id },
      data: { status: 'CANCELLED' },
    });
    return { lot: updated, refundedCents };
  });
}