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

export type ListPhase = Exclude<Phase, 'cancelled'>;

export type LotSort = 'ending' | 'newest' | 'bids' | 'price_asc' | 'price_desc';

export type LotsPage = {
  lots: LotSummary[];
  serverTime: string;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type CancelLotResponse = LotSummary & { refundedCents: number };

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

export type BidStanding = 'leading' | 'outbid' | 'won' | 'lost' | 'cancelled';

export type MyBidLot = LotSummary & {
  myLastBidCents: number | null;
  standing: BidStanding;
  receiptToken: string | null;
};

export type MyBidsResponse = { lots: MyBidLot[]; serverTime: string };

export type AuctioneerLotResult =
  | { outcome: 'sold'; amountCents: number; winner: string; receiptToken: string }
  | { outcome: 'unsold' };

export type AuctioneerLot = LotSummary & { result: AuctioneerLotResult | null };

export type AuctioneerLotsResponse = { lots: AuctioneerLot[]; serverTime: string };

export type AuditIssueCode =
  | 'SEQ_GAP'
  | 'BROKEN_LINK'
  | 'HASH_MISMATCH'
  | 'COUNT_MISMATCH'
  | 'HEAD_MISMATCH'
  | 'STATE_MISMATCH'
  | 'RECEIPT_MISMATCH';

export type AuditIssue = { code: AuditIssueCode | (string & {}); seq: number | null; message: string };

export type AuditBid = {
  seq: number;
  bidder: string;
  amountCents: number;
  at: string;
  prevHash: string;
  hash: string;
};

export type LotAudit = {
  lotId: string;
  title: string;
  phase: Phase;
  bidCount: number;
  genesisHash: string;
  headHash: string | null;
  finalHash: string | null;
  verification: { ok: boolean; issues: AuditIssue[] };
  bids: AuditBid[];
};
