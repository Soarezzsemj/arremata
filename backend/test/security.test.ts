import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';

const RUN = Date.now().toString(36);
const emails: string[] = [];
let counter = 0;

async function register(role: 'AUCTIONEER' | 'BIDDER') {
  counter += 1;
  const email = `sec-${RUN}-${counter}@teste.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Seg ${counter}`, email, password: 'senha123', role });
  expect(res.status).toBe(201);
  emails.push(email);
  return { token: res.body.token as string, email, body: res.body };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createLot(token: string) {
  const res = await request(app)
    .post('/api/lots')
    .set(auth(token))
    .send({
      externalSource: 'artic',
      externalId: `sec-${RUN}-${counter}`,
      title: 'Lote de segurança',
      imageUrl: null,
      attributes: {},
      startPriceCents: 1000,
      minIncrementCents: 100,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  const lots = await prisma.lot.findMany({
    where: { auctioneerId: { in: ids } },
    select: { id: true },
  });
  const lotIds = lots.map((l) => l.id);

  await prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.lot.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe.skipIf(!process.env.RUN_DB_TESTS)('segurança da API (com banco)', () => {
  it('nenhuma resposta de autenticação expõe o hash da senha', async () => {
    const { token, email, body } = await register('BIDDER');
    const login = await request(app).post('/api/auth/login').send({ email, password: 'senha123' });
    const me = await request(app).get('/api/auth/me').set(auth(token));

    for (const payload of [body, login.body, me.body]) {
      const text = JSON.stringify(payload);
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('$2');
    }
  });

  it('login com e-mail inexistente e com senha errada dão a mesma resposta', async () => {
    const { email } = await register('BIDDER');
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'senha-errada' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: `nao-existe-${RUN}@teste.local`, password: 'senha123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('exige login nas rotas protegidas', async () => {
    expect((await request(app).get('/api/me/wallet')).status).toBe(401);
    expect((await request(app).get('/api/me/bids')).status).toBe(401);
    expect((await request(app).get('/api/auctioneer/lots')).status).toBe(401);
    expect((await request(app).post('/api/lots/qualquer/bids').send({ amountCents: 1000 })).status).toBe(401);
  });

  it('respeita o papel: licitante e leiloeiro não trocam de funções', async () => {
    const auctioneer = await register('AUCTIONEER');
    const bidder = await register('BIDDER');
    const lotId = await createLot(auctioneer.token);

    const bidderCreatesLot = await request(app)
      .post('/api/lots')
      .set(auth(bidder.token))
      .send({});
    expect(bidderCreatesLot.status).toBe(403);

    const auctioneerBids = await request(app)
      .post(`/api/lots/${lotId}/bids`)
      .set(auth(auctioneer.token))
      .send({ amountCents: 1000 });
    expect(auctioneerBids.status).toBe(403);

    expect((await request(app).get('/api/auctioneer/lots').set(auth(bidder.token))).status).toBe(403);
    expect((await request(app).get('/api/me/bids').set(auth(auctioneer.token))).status).toBe(403);
    expect(
      (await request(app).post('/api/me/wallet/deposit').set(auth(auctioneer.token)).send({ amountCents: 1000 }))
        .status,
    ).toBe(403);
  });

  it('um leiloeiro não consegue cancelar o lote de outro', async () => {
    const owner = await register('AUCTIONEER');
    const intruder = await register('AUCTIONEER');
    const lotId = await createLot(owner.token);

    const res = await request(app).post(`/api/lots/${lotId}/cancel`).set(auth(intruder.token));
    expect(res.status).toBe(403);

    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    expect(lot.status).toBe('ACTIVE');
  });

  it('cada pessoa só enxerga a própria carteira', async () => {
    const a = await register('BIDDER');
    const b = await register('BIDDER');

    const dep = await request(app)
      .post('/api/me/wallet/deposit')
      .set(auth(a.token))
      .send({ amountCents: 5000 });
    expect(dep.status).toBe(201);

    const walletA = await request(app).get('/api/me/wallet').set(auth(a.token));
    const walletB = await request(app).get('/api/me/wallet').set(auth(b.token));
    expect(walletA.body.totalCents).toBe(5000);
    expect(walletB.body.totalCents).toBe(0);
  });

  it('rejeita token adulterado e token assinado com outro segredo', async () => {
    const { token } = await register('AUCTIONEER');

    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect((await request(app).get('/api/auctioneer/lots').set(auth(tampered))).status).toBe(401);

    const forged = jwt.sign({ userId: 'qualquer', role: 'AUCTIONEER' }, 'outro-segredo');
    expect((await request(app).get('/api/auctioneer/lots').set(auth(forged))).status).toBe(401);
  });

  it('rejeita corpo JSON grande demais e envia cabeçalhos de segurança', async () => {
    const big = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'x'.repeat(20_000) });
    expect(big.status).toBe(413);

    const health = await request(app).get('/api/health');
    expect(health.headers['x-powered-by']).toBeUndefined();
    expect(health.headers['x-content-type-options']).toBe('nosniff');
  });
});