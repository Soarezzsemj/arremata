import { Link } from 'react-router';
import { formatMoney } from '../lib/format';
import type { LotSummary } from '../lib/types';
import { Countdown } from './Countdown';
import { PhaseBadge } from './PhaseBadge';

export function LotCard({ lot }: { lot: LotSummary }) {
  const hasBids = lot.currentPriceCents !== null;

  return (
    <Link
      to={`/lots/${lot.id}`}
      className="overflow-hidden rounded-lg border border-slate-200 hover:shadow-md dark:border-slate-700"
    >
      {lot.imageUrl ? (
        <img src={lot.imageUrl} alt={lot.title} loading="lazy" className="h-48 w-full object-cover" />
      ) : (
        <div className="flex h-48 items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-800">
          Sem imagem
        </div>
      )}
      <div className="space-y-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{lot.title}</h3>
          <PhaseBadge phase={lot.phase} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {hasBids ? 'Lance atual' : 'Lance inicial'}:{' '}
          <strong>{formatMoney(lot.currentPriceCents ?? lot.startPriceCents)}</strong>
        </p>
        <p className="text-xs text-slate-500">
          <Countdown phase={lot.phase} startsAt={lot.startsAt} endsAt={lot.endsAt} />
        </p>
      </div>
    </Link>
  );
}