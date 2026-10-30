import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db';
import { app } from '../src/app';

const RUN = `lista${Date.now().toString(36)}`;
let auctioneerId = '';
const lotIds: string[] = [];

async function makeLot(
  suffix: string,
  extra: { startPriceCents: number; currentPriceCents?: number; bidCount?: number },
) {
  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      externalSource: 'artic',
      externalId: `${RUN}-${suffix}`,
      title: `Obra ${suffix} ${RUN}`,
      attributes: {},
      minIncrementCents: 100,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
      ...extra,
    },
  });
  lotIds.push(lot.id);
  return lot;
}

const list = (query: string) => request(app).get(`/api/lots?${query}`);
const titles = (body: { lots: { title: string }[] }) => body.lots.map((l) => l.title.split(' ')[1]);

describe.skipIf(!process.env.RUN_DB_TESTS)('listagem de lotes: busca, ordem e paginação', () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: {
        name: 'Leiloeiro lista',
        email: `${RUN}@teste.local`,
        passwordHash: 'x',
        role: 'AUCTIONEER',
        wallet: { create: {} },
      },
    });
    auctioneerId = u.id;

    await makeLot('A', { startPriceCents: 1000 }); // preço efetivo 1000, 0 lances
    await makeLot('B', { startPriceCents: 500, currentPriceCents: 3000, bidCount: 2 }); // 3000
    await makeLot('C', { startPriceCents: 2000 }); // 2000, 0 lances
  });

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { id: { in: lotIds } } });
    await prisma.wallet.deleteMany({ where: { userId: auctioneerId } });
    await prisma.user.deleteMany({ where: { id: auctioneerId } });
  });

  it('busca pelo título sem diferenciar maiúsculas', async () => {
    const res = await list(`q=${RUN.toUpperCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);

    const none = await list(`q=${RUN}-inexistente`);
    expect(none.body.total).toBe(0);
    expect(none.body.lots).toEqual([]);
  });

  it('ordena por preço usando o lance atual, ou o preço inicial se não há lances', async () => {
    const asc = await list(`q=${RUN}&sort=price_asc`);
    expect(titles(asc.body)).toEqual(['A', 'C', 'B']);
    const desc = await list(`q=${RUN}&sort=price_desc`);
    expect(titles(desc.body)).toEqual(['B', 'C', 'A']);
  });

  it('ordena por número de lances', async () => {
    const res = await list(`q=${RUN}&sort=bids`);
    expect(titles(res.body)[0]).toBe('B');
  });

  it('pagina e informa total e se há mais', async () => {
    const p1 = await list(`q=${RUN}&sort=price_asc&limit=2&page=1`);
    expect(titles(p1.body)).toEqual(['A', 'C']);
    expect(p1.body).toMatchObject({ total: 3, page: 1, pageSize: 2, hasMore: true });

    const p2 = await list(`q=${RUN}&sort=price_asc&limit=2&page=2`);
    expect(titles(p2.body)).toEqual(['B']);
    expect(p2.body.hasMore).toBe(false);
  });

  it('rejeita parâmetros inválidos com 400', async () => {
    expect((await list('sort=qualquer')).status).toBe(400);
    expect((await list('limit=1000')).status).toBe(400);
    expect((await list('page=0')).status).toBe(400);
    expect((await list(`q=${'x'.repeat(101)}`)).status).toBe(400);
    expect((await list('phase=nada')).status).toBe(400);
  });

  it('sem parâmetros continua funcionando como antes', async () => {
    const res = await list('');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.lots)).toBe(true);
    expect(res.body.serverTime).toBeTypeOf('string');
  });
});