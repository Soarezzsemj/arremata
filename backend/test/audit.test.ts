import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { placeBid } from '../src/services/bids';

const RUN = Date.now().toString(36);
const userIds: string[] = [];
const lotIds: string[] = [];
let counter = 0;

async function makeUser(role: 'AUCTIONEER' | 'BIDDER', totalCents = 0) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name: `Aud ${counter}`,
      email: `audit-${RUN}-${counter}@teste.local`,
      passwordHash: 'x',
      role,
      wallet: { create: { totalCents } },
    },
  });
  userIds.push(user.id);
  return user;
}

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.lot.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe.skipIf(!process.env.RUN_DB_TESTS)('GET /api/audit/:lotId (com banco)', () => {
  async function lotWithBids() {
    const auctioneer = await makeUser('AUCTIONEER');
    const a = await makeUser('BIDDER', 100_000);
    const b = await makeUser('BIDDER', 100_000);
    const lot = await prisma.lot.create({
      data: {
        auctioneerId: auctioneer.id,
        externalSource: 'artic',
        externalId: `aud-${RUN}-${counter}`,
        title: 'Lote de auditoria',
        attributes: {},
        startPriceCents: 1000,
        minIncrementCents: 100,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    lotIds.push(lot.id);
    await placeBid(lot.id, a.id, 1000);
    await placeBid(lot.id, b.id, 1200);
    await placeBid(lot.id, a.id, 1500);
    return { lot, users: [auctioneer.id, a.id, b.id] };
  }

  it('lote íntegro: verificação ok, hashes encadeados e sem ids reais', async () => {
    const { lot, users } = await lotWithBids();
    const res = await request(app).get(`/api/audit/${lot.id}`);

    expect(res.status).toBe(200);
    expect(res.body.verification.ok).toBe(true);
    expect(res.body.bids).toHaveLength(3);
    expect(res.body.bids[0].prevHash).toBe(res.body.genesisHash);
    expect(res.body.bids[1].prevHash).toBe(res.body.bids[0].hash);
    for (const id of users) expect(JSON.stringify(res.body)).not.toContain(id);
  });

  it('adulteração direta no banco é detectada', async () => {
    const { lot } = await lotWithBids();
    const target = await prisma.bid.findFirstOrThrow({ where: { lotId: lot.id, seq: 2 } });
    await prisma.bid.update({ where: { id: target.id }, data: { amountCents: 1100 } });

    const res = await request(app).get(`/api/audit/${lot.id}`);

    expect(res.body.verification.ok).toBe(false);
    expect(res.body.verification.issues.map((i: { code: string }) => i.code)).toContain(
      'HASH_MISMATCH',
    );
  });

  it('lote inexistente: 404', async () => {
    const res = await request(app).get('/api/audit/nao-existe');
    expect(res.status).toBe(404);
  });
});