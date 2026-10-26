import { createHmac } from 'node:crypto';
import { config } from '../config';

export function pseudonym(lotId: string, userId: string): string {
  const hash = createHmac('sha256', config.chainSecret)
    .update(`${lotId}:${userId}`)
    .digest('hex');
  return `Licitante #${hash.slice(0, 4).toUpperCase()}`;
}