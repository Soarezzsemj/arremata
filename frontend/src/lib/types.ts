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

export type LotBid = { seq: number; bidder: string; amountCents: number; at: string };


export type LotView = LotSummary & {
  attributes: Record<string, string>;
  bids: LotBid[];
  leader: string | null;
  viewer: string | null;
  serverTime: string;
  isOwner: boolean;
  result: LotResult | null;
};

export type LotResult =
  | { outcome: 'sold'; amountCents: number; winner: string; youWon: boolean; receiptToken: string | null }
  | { outcome: 'unsold' };

export type Receipt = {
  lotId: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, string>;
  winner: string;
  amountCents: number;
  bidCount: number;
  finalHash: string;
  issuedAt: string;
};

export type PlaceBidResponse = {
  bid: { seq: number; amountCents: number; createdAt: string };
  lot: { id: string; currentPriceCents: number; bidCount: number; endsAt: string };
  extended: boolean;
};

export type ExternalItem = {
  externalSource: string;
  externalId: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, string>;
};
export type LedgerType = 'DEPOSIT' | 'HOLD' | 'RELEASE' | 'SETTLE_DEBIT' | 'SETTLE_CREDIT';

export type LedgerEntry = {
  id: string;
  type: LedgerType;
  amountCents: number;
  lotId: string | null;
  createdAt: string;
};

export type Wallet = {
  totalCents: number;
  committedCents: number;
  availableCents: number;
  entries: LedgerEntry[];
};
