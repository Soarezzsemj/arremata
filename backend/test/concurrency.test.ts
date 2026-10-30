import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { placeBid } from '../src/services/bids';
import { verifyChain } from '../src/lib/chain';

const RUN = Date.now().toString(36);
const userIds: string[] = [];
const lotIds: string[] = [];
let counter = 0;

const START_PRICE = 1000;
const INCREMENT = 100;
const ALLOWED_REJECTIONS = ['BELOW_MIN', 'ALREADY_LEADING'];

async function makeUser(role: 'AUCTIONEER' | 'BIDDER', totalCents = 0) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name: `Conc ${counter}`,
      email: `conc-${RUN}-${counter}@teste.local`,
      passwordHash: 'x',
      role,
      wallet: { create: { totalCents } },
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeLot(auctioneerId: string) {
  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      externalSource: 'artic',
      externalId: `conc-${RUN}-${counter}`,
      title: 'Lote de concorrência',
      attributes: {},
      startPriceCents: START_PRICE,
      minIncrementCents: INCREMENT,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
    },
  });
  lotIds.push(lot.id);
  return lot;
}

async function makeBidders(n: number) {
  const bidders = [];
  for (let i = 0; i < n; i++) bidders.push(await makeUser('BIDDER', 1_000_000));
  return bidders;
}

type Attempt = { bidderId: string; amountCents: number };

async function fireAll(lotId: string, attempts: Attempt[]) {
  const results = await Promise.allSettled(
    attempts.map((a) => placeBid(lotId, a.bidderId, a.amountCents)),
  );
  const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
  const rejectionCodes = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => (r.reason as { code?: string })?.code ?? `ERRO-INESPERADO: ${String(r.reason)}`);
  return { fulfilled, rejectionCodes };
}

async function assertInvariants(lotId: string, bidderIds: string[], fulfilled: number) {
  const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
  const bids = await prisma.bid.findMany({ where: { lotId }, orderBy: { seq: 'asc' } });

  expect(bids).toHaveLength(fulfilled);
  expect(lot.bidCount).toBe(fulfilled);
  expect(bids.map((b) => b.seq)).toEqual(bids.map((_, i) => i + 1));

  bids.forEach((b, i) => {
    const min = i === 0 ? START_PRICE : bids[i - 1].amountCents + INCREMENT;
    expect(b.amountCents).toBeGreaterThanOrEqual(min);
  });

  const last = bids[bids.length - 1];
  expect(lot.currentPriceCents).toBe(last.amountCents);
  expect(lot.leaderId).toBe(last.bidderId);

  expect(verifyChain(bids, lot)).toEqual([]);

  for (const id of bidderIds) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: id } });
    expect(wallet.committedCents).toBe(id === last.bidderId ? last.amountCents : 0);

    const entries = await prisma.ledgerEntry.findMany({ where: { walletId: wallet.id } });
    const sum = (type: string) =>
      entries.filter((e) => e.type === type).reduce((acc, e) => acc + e.amountCents, 0);
    expect(sum('HOLD') - sum('RELEASE')).toBe(wallet.committedCents);
  }
}

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.lot.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe.skipIf(!process.env.RUN_DB_TESTS)('lances simultâneos (com banco)', () => {
  it('20 licitantes com valores diferentes ao mesmo tempo: estado consistente', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const bidders = await makeBidders(20);
    const lot = await makeLot(auctioneer.id);

    const attempts = bidders.map((b, i) => ({
      bidderId: b.id,
      amountCents: START_PRICE + INCREMENT * i,
    }));
    const { fulfilled, rejectionCodes } = await fireAll(lot.id, attempts);

    expect(fulfilled).toBeGreaterThanOrEqual(1);
    for (const code of rejectionCodes) expect(ALLOWED_REJECTIONS).toContain(code);
    expect(fulfilled + rejectionCodes.length).toBe(20);

    await assertInvariants(lot.id, bidders.map((b) => b.id), fulfilled);
  }, 30_000);

  it('20 licitantes dando o MESMO valor ao mesmo tempo: só 1 passa', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const bidders = await makeBidders(20);
    const lot = await makeLot(auctioneer.id);

    const attempts = bidders.map((b) => ({ bidderId: b.id, amountCents: 1500 }));
    const { fulfilled, rejectionCodes } = await fireAll(lot.id, attempts);

    expect(fulfilled).toBe(1);
    expect(rejectionCodes).toHaveLength(19);
    for (const code of rejectionCodes) expect(code).toBe('BELOW_MIN');

    await assertInvariants(lot.id, bidders.map((b) => b.id), 1);
  }, 30_000);

  it('5 licitantes com 3 lances cada, todos ao mesmo tempo: estado consistente', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const bidders = await makeBidders(5);
    const lot = await makeLot(auctioneer.id);

    const attempts: Attempt[] = [];
    for (let k = 0; k < 3; k++) {
      bidders.forEach((b, j) => {
        attempts.push({ bidderId: b.id, amountCents: START_PRICE + INCREMENT * (j + 5 * k) });
      });
    }
    const { fulfilled, rejectionCodes } = await fireAll(lot.id, attempts);

    expect(fulfilled).toBeGreaterThanOrEqual(1);
    for (const code of rejectionCodes) expect(ALLOWED_REJECTIONS).toContain(code);
    expect(fulfilled + rejectionCodes.length).toBe(15);

    await assertInvariants(lot.id, bidders.map((b) => b.id), fulfilled);
  }, 30_000);
});