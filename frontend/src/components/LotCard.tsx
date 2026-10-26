import { Link } from 'react-router';
import { formatMoney } from '../lib/format';
import type { LotSummary } from '../lib/types';
import { ArtImage } from './ArtImage';
import { Countdown } from './Countdown';
import { Corners } from './Frame';
import { PhaseBadge } from './PhaseBadge';
import { ScrambleText } from './ScrambleText';

export function LotCard({ lot, index }: { lot: LotSummary; index: number }) {
  const hasBids = lot.currentPriceCents !== null;

  return (
    <Link
      to={`/lots/${lot.id}`}
      className="lot-item group/item relative block p-3 transition-opacity duration-200 focus-visible:outline-offset-4"
    >
      {}
      <Corners className="opacity-0 transition-opacity duration-200 group-hover/item:opacity-100 group-focus-visible/item:opacity-100" />

      <div className="relative overflow-hidden">
        <ArtImage src={lot.imageUrl} title={lot.title} width={400} className="aspect-[4/5] w-full" />
        <span
          aria-hidden="true"
          className="ui-label absolute bottom-3 right-3 bg-accent px-3 py-2 text-night opacity-0 transition-opacity duration-200 group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
        >
          Ver lote ↳
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="ui-label text-muted">[{String(index + 1).padStart(2, '0')}]</span>
        <PhaseBadge phase={lot.phase} />
      </div>

      <h3 className="ui-display mt-2 line-clamp-2 text-xl leading-[1.05] md:text-2xl">
        <ScrambleText text={lot.title} />
      </h3>

      <dl className="ui-label mt-3 space-y-1 tabular-nums">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{hasBids ? 'Lance atual' : 'Lance inicial'}</dt>
          <dd>{formatMoney(lot.currentPriceCents ?? lot.startPriceCents)}</dd>
        </div>
        {(lot.phase === 'live' || lot.phase === 'scheduled') && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Tempo</dt>
            <dd>
              <Countdown phase={lot.phase} startsAt={lot.startsAt} endsAt={lot.endsAt} />
            </dd>
          </div>
        )}
      </dl>
    </Link>
  );
}
