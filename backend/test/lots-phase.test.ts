import { describe, expect, it } from 'vitest';
import { phaseOf } from '../src/lib/lots';

const t = (iso: string) => new Date(iso);
const STARTS = t('2026-01-01T10:00:00Z');
const ENDS = t('2026-01-01T12:00:00Z');

const lot = (status: 'ACTIVE' | 'CANCELLED' | 'SETTLED') => ({
  status,
  startsAt: STARTS,
  endsAt: ENDS,
});

describe('phaseOf', () => {
  it('antes do início: agendado', () => {
    expect(phaseOf(lot('ACTIVE'), t('2026-01-01T09:59:59Z'))).toBe('scheduled');
  });

  it('no instante exato do início: ao vivo', () => {
    expect(phaseOf(lot('ACTIVE'), STARTS)).toBe('live');
  });

  it('entre início e fim: ao vivo', () => {
    expect(phaseOf(lot('ACTIVE'), t('2026-01-01T11:00:00Z'))).toBe('live');
  });

  it('um instante antes do fim ainda é ao vivo', () => {
    expect(phaseOf(lot('ACTIVE'), t('2026-01-01T11:59:59.999Z'))).toBe('live');
  });

  it('no instante exato do fim: encerrado', () => {
    expect(phaseOf(lot('ACTIVE'), ENDS)).toBe('ended');
  });

  it('depois do fim, mesmo ainda não liquidado: encerrado', () => {
    expect(phaseOf(lot('ACTIVE'), t('2026-01-02T00:00:00Z'))).toBe('ended');
  });

  it('lote liquidado é sempre encerrado, mesmo com o relógio "antes" do fim', () => {
    expect(phaseOf(lot('SETTLED'), t('2026-01-01T11:00:00Z'))).toBe('ended');
  });

  it('lote cancelado é sempre cancelado, em qualquer horário', () => {
    expect(phaseOf(lot('CANCELLED'), t('2026-01-01T09:00:00Z'))).toBe('cancelled');
    expect(phaseOf(lot('CANCELLED'), t('2026-01-01T11:00:00Z'))).toBe('cancelled');
    expect(phaseOf(lot('CANCELLED'), t('2026-01-02T00:00:00Z'))).toBe('cancelled');
  });
});