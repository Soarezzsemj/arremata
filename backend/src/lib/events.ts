import { EventEmitter } from 'node:events';

export type LotEventType = 'bid' | 'settled';

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function emitLotEvent(lotId: string, type: LotEventType) {
  bus.emit(`lot:${lotId}`, type);
}

export function onLotEvent(lotId: string, listener: (type: LotEventType) => void) {
  bus.on(`lot:${lotId}`, listener);
  return () => bus.off(`lot:${lotId}`, listener);
}