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

export type LotView = LotSummary & {
  leader: string | null;
  viewer: string | null;
  bids: { seq: number; bidder: string; amountCents: number; at: string }[];
  serverTime: string;
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

export function toView(
  lot: Lot,
  bids: BidRow[],
  viewerId: string | null,
  now: Date = new Date(),
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
  };
}