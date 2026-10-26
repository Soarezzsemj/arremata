export type Role = 'AUCTIONEER' | 'BIDDER';

export type User = { id: string; name: string; email: string; role: Role };

export type Phase = 'scheduled' | 'live' | 'ended' | 'cancelled';

export type LotSummary = {
  id: string;
  title: string;
  imageUrl: string | null;
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
  attributes: Record<string, string>;
  bids: unknown[];
  leader: unknown;
  viewer: unknown;
  isOwner: boolean;
};

export type ExternalItem = {
  externalSource: string;
  externalId: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, string>;
};