import { formatRemaining } from '../lib/format';
import type { Phase } from '../lib/types';
import { useNow } from '../lib/useNow';

export function Countdown({ phase, startsAt, endsAt }: { phase: Phase; startsAt: string; endsAt: string }) {
  const now = useNow(new Date(phase === 'live' ? endsAt : startsAt).getTime());
  if (phase === 'live') return <span>Termina em {formatRemaining(new Date(endsAt).getTime() - now)}</span>;
  if (phase === 'scheduled') return <span>Começa em {formatRemaining(new Date(startsAt).getTime() - now)}</span>;
  return null;
}