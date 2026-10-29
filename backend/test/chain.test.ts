import { describe, expect, it } from 'vitest';
import {
  computeBidHash,
  genesisHash,
  verifyChain,
  type ChainBid,
  type ChainLot,
} from '../src/lib/chain';

const LOT_ID = 'lot-1';

function buildChain(amounts: number[]) {
  const bids: ChainBid[] = [];
  let prev = genesisHash(LOT_ID);
  amounts.forEach((amountCents, i) => {
    const seq = i + 1;
    const bidderId = i % 2 === 0 ? 'user-a' : 'user-b';
    const createdAt = new Date(1_700_000_000_000 + seq * 1000);
    const hash = computeBidHash(prev, LOT_ID, seq, bidderId, amountCents, createdAt.getTime());
    bids.push({ seq, bidderId, amountCents, createdAt, prevHash: prev, hash });
    prev = hash;
  });
  const last = bids[bids.length - 1];
  const lot: ChainLot = {
    id: LOT_ID,
    bidCount: bids.length,
    headHash: last ? last.hash : null,
    currentPriceCents: last ? last.amountCents : 1000,
    leaderId: last ? last.bidderId : null,
  };
  return { bids, lot };
}

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe('verifyChain', () => {
  it('aceita uma cadeia íntegra', () => {
    const { bids, lot } = buildChain([1000, 1500, 2000, 2600]);
    expect(verifyChain(bids, lot)).toEqual([]);
  });

  it('aceita lote sem lances', () => {
    const { bids, lot } = buildChain([]);
    expect(verifyChain(bids, lot)).toEqual([]);
  });

  it('detecta valor alterado', () => {
    const { bids, lot } = buildChain([1000, 1500, 2000]);
    bids[1].amountCents = 1200;
    expect(codes(verifyChain(bids, lot))).toContain('HASH_MISMATCH');
  });

  it('detecta lance removido do meio', () => {
    const { bids, lot } = buildChain([1000, 1500, 2000, 2500]);
    bids.splice(1, 1);
    const found = codes(verifyChain(bids, lot));
    expect(found).toContain('SEQ_GAP');
    expect(found).toContain('COUNT_MISMATCH');
  });

  it('detecta último lance removido', () => {
    const { bids, lot } = buildChain([1000, 1500, 2000]);
    bids.pop();
    const found = codes(verifyChain(bids, lot));
    expect(found).toContain('COUNT_MISMATCH');
    expect(found).toContain('HEAD_MISMATCH');
  });

  it('detecta ordem trocada', () => {
    const { bids, lot } = buildChain([1000, 1500, 2000, 2500]);
    const s = bids[1].seq;
    bids[1].seq = bids[2].seq;
    bids[2].seq = s;
    expect(verifyChain(bids, lot).length).toBeGreaterThan(0);
  });

  it('detecta preço do lote adulterado', () => {
    const { bids, lot } = buildChain([1000, 1500]);
    lot.currentPriceCents = 99;
    expect(codes(verifyChain(bids, lot))).toContain('STATE_MISMATCH');
  });

  it('confere o hash final do recibo', () => {
    const { bids, lot } = buildChain([1000, 1500]);
    expect(verifyChain(bids, lot, { finalHash: lot.headHash! })).toEqual([]);
    expect(codes(verifyChain(bids, lot, { finalHash: 'forjado' }))).toContain('RECEIPT_MISMATCH');
  });
});