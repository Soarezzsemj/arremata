import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { placeBid } from '../src/services/bids';
import { verifyChain } from '../src/lib/chain';

const RUN = Date.now().toString(36);
const userIds: string[] = [];
const lotIds: string[] = [];
let counter = 0;

async function makeUser(role: 'AUCTIONEER' | 'BIDDER', totalCents = 0) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name: `Teste ${counter}`,
      email: `bids-${RUN}-${counter}@teste.local`,
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
  overrides: Partial<{ startsAt: Date; endsAt: Date; startPriceCents: number; minIncrementCents: number }> = {},
) {
  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      externalSource: 'artic',
      externalId: `teste-${RUN}-${counter}`,
      title: 'Lote de teste',
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

describe.skipIf(!process.env.RUN_DB_TESTS)('motor de lances (com banco)', () => {
  it('aceita um lance válido e reserva o saldo', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const bidder = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    const result = await placeBid(lot.id, bidder.id, 1500);

    expect(result.bid.seq).toBe(1);
    expect(result.lot.currentPriceCents).toBe(1500);
    expect(result.lot.bidCount).toBe(1);
    expect((await walletOf(bidder.id)).committedCents).toBe(1500);
  });

  it('libera o saldo do líder anterior quando ele é superado', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const b = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 1500);
    await placeBid(lot.id, b.id, 2000);

    expect((await walletOf(a.id)).committedCents).toBe(0);
    expect((await walletOf(b.id)).committedCents).toBe(2000);
    const updated = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(updated.leaderId).toBe(b.id);
  });

  it('recusa lance de quem já lidera', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 1500);
    await expect(placeBid(lot.id, a.id, 2000)).rejects.toMatchObject({ code: 'ALREADY_LEADING' });
  });

  it('recusa lance abaixo do mínimo e informa o mínimo', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const b = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await expect(placeBid(lot.id, a.id, 500)).rejects.toMatchObject({
      code: 'BELOW_MIN',
      details: { minCents: 1000 },
    });

    await placeBid(lot.id, a.id, 1500);
    await expect(placeBid(lot.id, b.id, 1550)).rejects.toMatchObject({
      code: 'BELOW_MIN',
      details: { minCents: 1600 },
    });
  });

  it('recusa saldo insuficiente e não grava nada', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const poor = await makeUser('BIDDER', 1000);
    const lot = await makeLot(auctioneer.id);

    await expect(placeBid(lot.id, poor.id, 5000)).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
    });

    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.bidCount).toBe(0);
    expect((await walletOf(poor.id)).committedCents).toBe(0);
  });

  it('recusa lance em lote encerrado e em lote que não começou', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const ended = await makeLot(auctioneer.id, {
      startsAt: new Date(Date.now() - 2 * 60 * 60_000),
      endsAt: new Date(Date.now() - 60_000),
    });
    const future = await makeLot(auctioneer.id, {
      startsAt: new Date(Date.now() + 60 * 60_000),
      endsAt: new Date(Date.now() + 2 * 60 * 60_000),
    });

    await expect(placeBid(ended.id, a.id, 1500)).rejects.toMatchObject({ code: 'ENDED' });
    await expect(placeBid(future.id, a.id, 1500)).rejects.toMatchObject({ code: 'NOT_STARTED' });
  });
  
  it('anti-sniping: lance nos últimos 2 minutos estende o fim', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const closing = await makeLot(auctioneer.id, { endsAt: new Date(Date.now() + 30_000) });
    const far = await makeLot(auctioneer.id);

    const r1 = await placeBid(closing.id, a.id, 1500);
    expect(r1.extended).toBe(true);
    expect(r1.lot.endsAt.getTime()).toBeGreaterThan(Date.now() + 90_000);

    const r2 = await placeBid(far.id, a.id, 1500);
    expect(r2.extended).toBe(false);
    expect(r2.lot.endsAt.getTime()).toBe(far.endsAt.getTime());
  });

  it('dois lances simultâneos iguais: só um passa', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const b = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    const results = await Promise.allSettled([
      placeBid(lot.id, a.id, 3000),
      placeBid(lot.id, b.id, 3000),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.bidCount).toBe(1);
    const wa = await walletOf(a.id);
    const wb = await walletOf(b.id);
    expect(wa.committedCents + wb.committedCents).toBe(3000);
  });

  it('a cadeia de hashes fica íntegra depois de vários lances', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 100_000);
    const b = await makeUser('BIDDER', 100_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 1000);
    await placeBid(lot.id, b.id, 1200);
    await placeBid(lot.id, a.id, 1500);
    await placeBid(lot.id, b.id, 2000);

    const bids = await prisma.bid.findMany({ where: { lotId: lot.id } });
    const updated = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(verifyChain(bids, updated)).toEqual([]);
  });
});