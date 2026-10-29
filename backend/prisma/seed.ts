import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '../src/db';
import { placeBid } from '../src/services/bids';
import { settleLot } from '../src/services/settlement';
import { searchArtworks, type ExternalItem } from '../src/services/external';

const isReset = process.argv.includes('--reset');
const confirmed = process.argv.includes('--yes');

const PASSWORD = 'senha123';
const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

type DemoUser = { name: string; email: string; role: Role; walletCents: number };

const DEMO_USERS: DemoUser[] = [
  { name: 'Leiloeiro Demo', email: 'leiloeiro@arremata.dev', role: 'AUCTIONEER', walletCents: 0 },
  { name: 'Ana Souza', email: 'ana@arremata.dev', role: 'BIDDER', walletCents: 5_000_000 },
  { name: 'Bruno Lima', email: 'bruno@arremata.dev', role: 'BIDDER', walletCents: 5_000_000 },
];

const FALLBACK: ExternalItem[] = [
  { externalSource: 'artic', externalId: '16568', title: 'Water Lilies', imageUrl: null, attributes: { Artista: 'Claude Monet', Data: '1906' } },
  { externalSource: 'artic', externalId: '27992', title: 'A Sunday on La Grande Jatte', imageUrl: null, attributes: { Artista: 'Georges Seurat', Data: '1884-86' } },
  { externalSource: 'artic', externalId: '111628', title: 'Nighthawks', imageUrl: null, attributes: { Artista: 'Edward Hopper', Data: '1942' } },
  { externalSource: 'artic', externalId: '28560', title: 'The Bedroom', imageUrl: null, attributes: { Artista: 'Vincent van Gogh', Data: '1889' } },
];

function checkTarget() {
  let host = 'localhost';
  try {
    host = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/x').hostname;
  } catch {
  }
  const isLocal = ['localhost', '127.0.0.1', '::1', 'db'].includes(host);
  console.log(`Banco de destino: ${host}${isLocal ? ' (local)' : ' (REMOTO)'}`);

  if (!isLocal) {
    if (!confirmed) {
      console.error('Banco remoto: rode de novo com --yes para confirmar.');
      process.exit(1);
    }
    if (!process.env.CHAIN_SECRET) {
      console.error('Banco remoto: defina CHAIN_SECRET com o MESMO valor usado pela API em produção.');
      process.exit(1);
    }
  }
}

async function reset() {
  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_USERS.map((u) => u.email) } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const lots = await prisma.lot.findMany({
    where: { auctioneerId: { in: userIds } },
    select: { id: true },
  });
  const lotIds = lots.map((l) => l.id);

  await prisma.receipt.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.bid.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.lot.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log('Dados de demonstração removidos.');
}

async function ensureUser(u: DemoUser, passwordHash: string) {
  const found = await prisma.user.findUnique({ where: { email: u.email } });
  if (found) return found;

  return prisma.user.create({
    data: {
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      wallet: {
        create: {
          totalCents: u.walletCents,
          entries: {
            create: u.walletCents > 0 ? [{ type: 'DEPOSIT', amountCents: u.walletCents }] : [],
          },
        },
      },
    },
  });
}

async function pickArtworks(): Promise<ExternalItem[]> {
  const picked: ExternalItem[] = [];
  for (const q of ['monet', 'van gogh', 'hopper', 'degas']) {
    try {
      const items = await searchArtworks(q);
      const item = items.find(
        (i) => i.imageUrl && !picked.some((p) => p.externalId === i.externalId),
      );
      if (item) picked.push(item);
    } catch {}
  }
  for (const f of FALLBACK) {
    if (picked.length >= 4) break;
    if (!picked.some((p) => p.externalId === f.externalId)) picked.push(f);
  }
  return picked.slice(0, 4);
}

type LotTiming = {
  startsAt: Date;
  endsAt: Date;
  startPriceCents: number;
  minIncrementCents: number;
};

function createLot(auctioneerId: string, art: ExternalItem, t: LotTiming) {
  return prisma.lot.create({
    data: {
      auctioneerId,
      externalSource: art.externalSource,
      externalId: art.externalId,
      title: art.title,
      imageUrl: art.imageUrl,
      attributes: art.attributes,
      ...t,
    },
  });
}

async function main() {
  checkTarget();
  if (isReset) await reset();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const auctioneer = await ensureUser(DEMO_USERS[0], passwordHash);
  const ana = await ensureUser(DEMO_USERS[1], passwordHash);
  const bruno = await ensureUser(DEMO_USERS[2], passwordHash);

  const alreadySeeded = await prisma.lot.count({ where: { auctioneerId: auctioneer.id } });
  if (alreadySeeded > 0) {
    console.log('Os lotes de demonstração já existem. Use --reset para recriar.');
    return;
  }

  const [art1, art2, art3, art4] = await pickArtworks();
  const now = Date.now();

  const live = await createLot(auctioneer.id, art1, {
    startsAt: new Date(now - 2 * H),
    endsAt: new Date(now + 7 * D),
    startPriceCents: 500_000,
    minIncrementCents: 50_000,
  });
  for (const [who, amount] of [
    [ana, 500_000],
    [bruno, 550_000],
    [ana, 620_000],
    [bruno, 700_000],
    [ana, 800_000],
  ] as const) {
    await placeBid(live.id, who.id, amount);
  }

  await createLot(auctioneer.id, art2, {
    startsAt: new Date(now - H),
    endsAt: new Date(now + 3 * D),
    startPriceCents: 200_000,
    minIncrementCents: 20_000,
  });

  await createLot(auctioneer.id, art3, {
    startsAt: new Date(now + 2 * D),
    endsAt: new Date(now + 5 * D),
    startPriceCents: 300_000,
    minIncrementCents: 30_000,
  });

  const done = await createLot(auctioneer.id, art4, {
    startsAt: new Date(now - 3 * D),
    endsAt: new Date(now + H),
    startPriceCents: 100_000,
    minIncrementCents: 10_000,
  });
  for (const [who, amount] of [
    [ana, 100_000],
    [bruno, 120_000],
    [ana, 150_000],
    [bruno, 180_000],
  ] as const) {
    await placeBid(done.id, who.id, amount);
  }
  await prisma.lot.update({ where: { id: done.id }, data: { endsAt: new Date(now - MIN) } });
  await settleLot(done.id);

  console.log('Seed concluído.');
  console.log(`Senha de todos: ${PASSWORD}`);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());