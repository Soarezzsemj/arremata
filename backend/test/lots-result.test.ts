import { describe, expect, it } from 'vitest';
import type { Lot } from '@prisma/client';
import { toView } from '../src/lib/lots';

function makeLot(status: 'ACTIVE' | 'SETTLED' | 'CANCELLED'): Lot {
  return {
    id: 'lot-1',
    auctioneerId: 'auc',
    title: 'Teste',
    imageUrl: null,
    attributes: {},
    startPriceCents: 1000,
    minIncrementCents: 100,
    startsAt: new Date(0),
    endsAt: new Date(1000),
    status,
    currentPriceCents: 6000,
    bidCount: 2,
    leaderId: 'win',
  } as unknown as Lot;
}

const receipt = { token: 'tok-123', winnerId: 'win', amountCents: 6000 };

describe('toView.result', () => {
  it('é nulo enquanto o lote não foi liquidado', () => {
    expect(toView(makeLot('ACTIVE'), [], null).result).toBeNull();
    expect(toView(makeLot('CANCELLED'), [], null).result).toBeNull();
  });

  it('lote liquidado sem comprovante é "unsold"', () => {
    expect(toView(makeLot('SETTLED'), [], null).result).toEqual({ outcome: 'unsold' });
  });

  it('o vencedor vê youWon e o token', () => {
    const r = toView(makeLot('SETTLED'), [], 'win', new Date(), receipt).result;
    expect(r).toMatchObject({ outcome: 'sold', youWon: true, receiptToken: 'tok-123' });
  });

  it('o leiloeiro vê o token mas não é o vencedor', () => {
    const r = toView(makeLot('SETTLED'), [], 'auc', new Date(), receipt).result;
    expect(r).toMatchObject({ youWon: false, receiptToken: 'tok-123' });
  });

  it('outro licitante e visitante não recebem o token', () => {
    const other = toView(makeLot('SETTLED'), [], 'other', new Date(), receipt).result;
    const anon = toView(makeLot('SETTLED'), [], null, new Date(), receipt).result;
    expect(other).toMatchObject({ youWon: false, receiptToken: null });
    expect(anon).toMatchObject({ youWon: false, receiptToken: null });
  });

  it('nunca expõe o id do vencedor', () => {
    const r = toView(makeLot('SETTLED'), [], null, new Date(), receipt);
    expect(JSON.stringify(r)).not.toContain('"win"');
  });
});