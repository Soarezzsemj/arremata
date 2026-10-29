import { Lot, LotStatus } from '@prisma/client';
import { pseudonym } from './pseudonym';

export type Phase = 'scheduled' | 'live' | 'ended' | 'cancelled';

export function phaseOf(
  lot: { status: LotStatus; startsAt: Date; endsAt: Date },
  now: Date,
): Phase {
  if (lot.status === 'CANCELLED') return 'cancelled';
  if (lot.status === 'SETTLED' || now >= lot.endsAt) return 'ended';
  if (now < lot.startsAt) return 'scheduled';
  return 'live';
}


export type LotSummary = {
  id: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, string>;
  startPriceCents: number;
  minIncrementCents: number;
  startsAt: string;
  endsAt: string;
  phase: Phase;
  currentPriceCents: number | null;
  nextMinBidCents: number;
  bidCount: number;
};

export type LotResult =
  | {
      outcome: 'sold';
      amountCents: number;
      winner: string; // pseudônimo
      youWon: boolean;
      receiptToken: string | null; // só o vencedor e o leiloeiro recebem
    }
  | { outcome: 'unsold' };

export type ReceiptRow = { token: string; winnerId: string; amountCents: number };

export type LotView = LotSummary & {
  leader: string | null;
  viewer: string | null;
  bids: { seq: number; bidder: string; amountCents: number; at: string }[];
  serverTime: string;
  result: LotResult | null;
};


export function nextMinBid(
  lot: Pick<Lot, 'startPriceCents' | 'minIncrementCents' | 'currentPriceCents'>,
): number {
  return lot.currentPriceCents === null
    ? lot.startPriceCents
    : lot.currentPriceCents + lot.minIncrementCents;
}

export function toSummary(lot: Lot, now: Date = new Date()): LotSummary {
  return {
    id: lot.id,
    title: lot.title,
    imageUrl: lot.imageUrl,
    attributes: lot.attributes as Record<string, string>,
    startPriceCents: lot.startPriceCents,
    minIncrementCents: lot.minIncrementCents,
    startsAt: lot.startsAt.toISOString(),
    endsAt: lot.endsAt.toISOString(),
    phase: phaseOf(lot, now),
    currentPriceCents: lot.currentPriceCents,
    nextMinBidCents: nextMinBid(lot),
    bidCount: lot.bidCount,
  };
}

type BidRow = { seq: number; bidderId: string; amountCents: number; createdAt: Date };

function resultOf(
  lot: Lot,
  viewerId: string | null,
  receipt: ReceiptRow | null,
): LotResult | null {
  if (lot.status !== 'SETTLED') return null;
  if (!receipt) return { outcome: 'unsold' };

  const isWinner = viewerId !== null && viewerId === receipt.winnerId;
  const isOwner = viewerId !== null && viewerId === lot.auctioneerId;
  return {
    outcome: 'sold',
    amountCents: receipt.amountCents,
    winner: pseudonym(lot.id, receipt.winnerId),
    youWon: isWinner,
    receiptToken: isWinner || isOwner ? receipt.token : null,
  };
}

export function toView(
  lot: Lot,
  bids: BidRow[],
  viewerId: string | null,
  now: Date = new Date(),
  receipt: ReceiptRow | null = null,
): LotView {
  return {
    ...toSummary(lot, now),
    leader: lot.leaderId ? pseudonym(lot.id, lot.leaderId) : null,
    viewer: viewerId ? pseudonym(lot.id, viewerId) : null,
    bids: bids.map((b) => ({
      seq: b.seq,
      bidder: pseudonym(lot.id, b.bidderId),
      amountCents: b.amountCents,
      at: b.createdAt.toISOString(),
    })),
    serverTime: now.toISOString(),
    result: resultOf(lot, viewerId, receipt),
  };
}