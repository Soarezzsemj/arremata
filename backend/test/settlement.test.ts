import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { placeBid } from '../src/services/bids';
import { settleDueLots, settleLot } from '../src/services/settlement';
import { verifyChain } from '../src/lib/chain';

const RUN = Date.now().toString(36);
const userIds: string[] = [];
const lotIds: string[] = [];
let counter = 0;

async function makeUser(role: 'AUCTIONEER' | 'BIDDER', totalCents = 0) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name: `Liq ${counter}`,
      email: `settle-${RUN}-${counter}@teste.local`,
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
      externalId: `liq-${RUN}-${counter}`,
      title: 'Lote de liquidação',
      attributes: {},
      startPriceCents: 1000,
      minIncrementCents: 100,
      startsAt: new Date(Date.now() - 2 * 60 * 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
    },
  });
  lotIds.push(lot.id);
  return lot;
}

// Simula o fim do leilão: lances só são aceitos antes do fim, então vencemos o prazo depois.
const expire = (lotId: string) =>
  prisma.lot.update({ where: { id: lotId }, data: { endsAt: new Date(Date.now() - 60_000) } });

const walletOf = (userId: string) => prisma.wallet.findUniqueOrThrow({ where: { userId } });

afterAll(async () => {
  await prisma.receipt.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.lot.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe.skipIf(!process.env.RUN_DB_TESTS)('liquidação (com banco)', () => {
  it('liquida: debita o vencedor, credita o leiloeiro e emite o comprovante', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const b = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 5000);
    await placeBid(lot.id, b.id, 6000);
    await expire(lot.id);

    const receipt = await settleLot(lot.id);

    expect(receipt).not.toBeNull();
    expect(receipt!.winnerId).toBe(b.id);
    expect(receipt!.amountCents).toBe(6000);
    expect(receipt!.bidCount).toBe(2);

    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.status).toBe('SETTLED');
    expect(receipt!.finalHash).toBe(after.headHash);

    const wa = await walletOf(a.id);
    const wb = await walletOf(b.id);
    const wAuctioneer = await walletOf(auctioneer.id);
    expect(wa).toMatchObject({ totalCents: 10_000, committedCents: 0 });
    expect(wb).toMatchObject({ totalCents: 4000, committedCents: 0 });
    expect(wAuctioneer.totalCents).toBe(6000);

    const debit = await prisma.ledgerEntry.findFirst({
      where: { walletId: wb.id, type: 'SETTLE_DEBIT', lotId: lot.id },
    });
    const credit = await prisma.ledgerEntry.findFirst({
      where: { walletId: wAuctioneer.id, type: 'SETTLE_CREDIT', lotId: lot.id },
    });
    expect(debit?.amountCents).toBe(6000);
    expect(credit?.amountCents).toBe(6000);
  });

  it('o hash final do comprovante bate com a cadeia', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const b = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 1000);
    await placeBid(lot.id, b.id, 1200);
    await expire(lot.id);
    const receipt = await settleLot(lot.id);

    const bids = await prisma.bid.findMany({ where: { lotId: lot.id } });
    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(verifyChain(bids, after, { finalHash: receipt!.finalHash })).toEqual([]);
  });

  it('é idempotente: liquidar duas vezes não cobra duas vezes', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 3000);
    await expire(lot.id);

    await settleLot(lot.id);
    const second = await settleLot(lot.id);

    expect(second).toBeNull();
    expect((await walletOf(a.id)).totalCents).toBe(7000);
    expect((await walletOf(auctioneer.id)).totalCents).toBe(3000);
    expect(await prisma.receipt.count({ where: { lotId: lot.id } })).toBe(1);
  });

  it('não liquida lote que ainda não venceu', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 3000);
    const result = await settleLot(lot.id);

    expect(result).toBeNull();
    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.status).toBe('ACTIVE');
    expect((await walletOf(a.id)).committedCents).toBe(3000);
  });

  it('lote sem lances encerra sem comprovante', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const lot = await makeLot(auctioneer.id);
    await expire(lot.id);

    const result = await settleLot(lot.id);

    expect(result).toBeNull();
    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.status).toBe('SETTLED');
    expect(await prisma.receipt.count({ where: { lotId: lot.id } })).toBe(0);
  });

  it('a varredura liquida os lotes vencidos', async () => {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 10_000);
    const lot = await makeLot(auctioneer.id);

    await placeBid(lot.id, a.id, 2000);
    await expire(lot.id);

    await settleDueLots();

    const after = await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(after.status).toBe('SETTLED');
    expect(await prisma.receipt.count({ where: { lotId: lot.id } })).toBe(1);
  });
});