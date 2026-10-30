import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { placeBid } from '../src/services/bids';
import { cancelLot } from '../src/services/cancel';
import { verifyChain } from '../src/lib/chain';

const RUN = Date.now().toString(36);
const userIds: string[] = [];
const lotIds: string[] = [];
let counter = 0;

async function makeUser(role: 'AUCTIONEER' | 'BIDDER', totalCents = 0) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name: `Cancel ${counter}`,
      email: `cancel-${RUN}-${counter}@teste.local`,
      passwordHash: 'x',
      role,
      wallet: { create: { totalCents } },
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeLot(
  auctioneerId: string,
  overrides: Partial<{ startsAt: Date; endsAt: Date }> = {},
) {
  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      externalSource: 'artic',
      externalId: `cancel-${RUN}-${counter}`,
      title: 'Lote de cancelamento',
      attributes: {},
      startPriceCents: 1000,
      minIncrementCents: 100,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
      ...overrides,
    },
  });
  lotIds.push(lot.id);
  return lot;
}

const walletOf = (userId: string) => prisma.wallet.findUniqueOrThrow({ where: { userId } });

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.lot.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe.skipIf(!process.env.RUN_DB_TESTS)('cancelamento de lote com lances (com banco)', () => {
  it('cancela, devolve a reserva do líder e mantém a cadeia íntegra', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const b = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 1500);
    await placeBid(lot.id, b.id, 2000);
    expect((await walletOf(b.id)).committedCents).toBe(2000);

    const { lot: cancelled, refundedCents } = await cancelLot(lot.id, auctioneer.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(refundedCents).toBe(2000);
    expect((await walletOf(a.id)).committedCents).toBe(0);
    const wb = await walletOf(b.id);
    expect(wb.committedCents).toBe(0);
    expect(wb.totalCents).toBe(10_000); 

    
    const bids = await prisma.bid.findMany({ where: { lotId: lot.id }, orderBy: { seq: 'asc' } });
    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(bids).toHaveLength(2);
    expect(verifyChain(bids, after)).toEqual([]);

    
    await expect(placeBid(lot.id, a.id, 5000)).rejects.toMatchObject({ code: 'LOT_CANCELLED' });
  });

  it('cancelar duas vezes não devolve saldo duas vezes', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);
    await placeBid(lot.id, a.id, 1500);

    await cancelLot(lot.id, auctioneer.id);
    const second = await cancelLot(lot.id, auctioneer.id);

    expect(second.refundedCents).toBe(0);
    const releases = await prisma.ledgerEntry.count({
      where: { wallet: { userId: a.id }, type: 'RELEASE' },
    });
    expect(releases).toBe(1);
    expect((await walletOf(a.id)).committedCents).toBe(0);
  });

  it('cancela lote sem lances (sem devolução)', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const lot = await makeLot(auctioneer.id);

    const { lot: cancelled, refundedCents } = await cancelLot(lot.id, auctioneer.id);
    expect(cancelled.status).toBe('CANCELLED');
    expect(refundedCents).toBe(0);
  });

  it('outro leiloeiro não consegue cancelar', async () => {
    const owner = await makeUser('AUCTIONEER');
    const intruder = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(owner.id);
    await placeBid(lot.id, a.id, 1500);

    await expect(cancelLot(lot.id, intruder.id)).rejects.toThrow();

    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.status).toBe('ACTIVE');
    expect((await walletOf(a.id)).committedCents).toBe(1500);
  });

  it('não cancela lote já encerrado', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const lot = await makeLot(auctioneer.id, {
      startsAt: new Date(Date.now() - 2 * 60 * 60_000),
      endsAt: new Date(Date.now() - 60_000),
    });

    await expect(cancelLot(lot.id, auctioneer.id)).rejects.toMatchObject({ code: 'ENDED' });
  });

  it('cancelamento e lance simultâneos: o saldo sempre fecha em zero', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const b = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);
    await placeBid(lot.id, a.id, 1500);

    await Promise.allSettled([
      cancelLot(lot.id, auctioneer.id),
      placeBid(lot.id, b.id, 2000),
    ]);

    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.status).toBe('CANCELLED');
    expect((await walletOf(a.id)).committedCents).toBe(0);
    expect((await walletOf(b.id)).committedCents).toBe(0);

    const bids = await prisma.bid.findMany({ where: { lotId: lot.id }, orderBy: { seq: 'asc' } });
    expect(verifyChain(bids, after)).toEqual([]);
  });
});