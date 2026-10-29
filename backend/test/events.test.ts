import { describe, expect, it } from 'vitest';
import { emitLotEvent, onLotEvent } from '../src/lib/events';

describe('eventos de lote', () => {
  it('entrega só para quem assinou aquele lote e para de entregar ao cancelar', () => {
    const received: string[] = [];
    const off = onLotEvent('lot-a', (t) => received.push(t));

    emitLotEvent('lot-a', 'bid');
    emitLotEvent('lot-b', 'bid');
    expect(received).toEqual(['bid']);

    off();
    emitLotEvent('lot-a', 'settled');
    expect(received).toEqual(['bid']);
  });
});