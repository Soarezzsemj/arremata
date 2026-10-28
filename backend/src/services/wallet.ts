import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AppError, conflict, notFound } from '../lib/errors';

const LEDGER_LIMIT = 20;

const MAX_TOTAL_CENTS = 2_000_000_000;


type Tx = Prisma.TransactionClient;

export async function getWallet(userId: string) {
    const wallet = await prisma.wallet.findUnique({
        where: { userId },
        include: { entries: { orderBy: { createdAt: 'desc' }, take: LEDGER_LIMIT } },
    })


    if (!wallet) throw notFound('Carteira não encontrada');

    return {

        totalCents: wallet.totalCents,
        committedCents: wallet.committedCents,
        availableCents: wallet.totalCents - wallet.committedCents,
        entries: wallet.entries.map(e => ({
            id: e.id,
            type: e.type,
            amountCents: e.amountCents,
            lotId: e.lotId,
            createdAt: e.createdAt,
        })),
    };
}



export async function deposit(userId: string, amountCents: number) {
    await prisma.$transaction(async (tx) => {
        const updated = await tx.wallet.updateMany({
            where: { userId, totalCents: { lte: MAX_TOTAL_CENTS - amountCents } },
            data: { totalCents: { increment: amountCents } },
        });
        if (updated.count === 0) { throw conflict('WALLET_LIMIT', 'O saldo máximo da carteira foi atingido.'); }


        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } })
        await tx.ledgerEntry.create({
            data: { walletId: wallet.id, type: 'DEPOSIT', amountCents },
        });
    });

    return getWallet(userId);
}


export async function holdFunds(tx: Tx, userId: string, lotId: string, amountCents: number) {

    const updated = await tx.$executeRaw`
    UPDATE "Wallet"
    SET "committedCents" = "committedCents" + ${amountCents}
    WHERE "userId" = ${userId}
      AND "totalCents" - "committedCents" >= ${amountCents}`;

    if (updated === 0) {
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
        throw new AppError(409, 'INSUFFICIENT_FUNDS', 'Saldo insuficiente para reservar fundos.', {
            availableCents: wallet.totalCents - wallet.committedCents,
        });

    }

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    await tx.ledgerEntry.create({
        data: { walletId: wallet.id, type: 'HOLD', amountCents, lotId },
    });
}


export async function releaseFunds(tx: Tx, userId: string, lotId: string, amountCents: number) {
    const updated = await tx.wallet.updateMany({
        where: { userId, committedCents: { gte: amountCents } },
        data: { committedCents: { decrement: amountCents } },
    });

    if (updated.count === 0) {
        throw new Error('Tentativa de liberar mais saldo do que está comprometido');
    }

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    await tx.ledgerEntry.create({
        data: { walletId: wallet.id, type: 'RELEASE', amountCents, lotId },
    });
}