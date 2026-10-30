import { describe, expect, it } from 'vitest';
import { pseudonym } from '../src/lib/pseudonym';

const FORMAT = /^Licitante #[0-9A-F]{4}$/;

describe('pseudonym', () => {
  it('tem o formato "Licitante #XXXX" (4 hex maiúsculos)', () => {
    expect(pseudonym('lote-1', 'user-1')).toMatch(FORMAT);
  });

  it('é estável: mesmo lote e mesmo usuário dão sempre o mesmo pseudônimo', () => {
    expect(pseudonym('lote-1', 'user-1')).toBe(pseudonym('lote-1', 'user-1'));
  });

  it('muda de um lote para outro para o mesmo usuário', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => pseudonym(`lote-${i}`, 'user-1')));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('muda de um usuário para outro no mesmo lote', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => pseudonym('lote-1', `user-${i}`)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('não vaza o id do usuário', () => {
    const userId = 'b0b0b0b0-1111-2222-3333-444444444444';
    expect(pseudonym('lote-1', userId)).not.toContain(userId);
  });
});