import { Link } from 'react-router';
import { ANTI_SNIPING_WINDOW_MS } from '../lib/auction';
import { formatMoney } from '../lib/format';
import type { LotSummary } from '../lib/types';
import { useNow } from '../lib/useNow';
import { ArtImage } from './ArtImage';
import { CancelledSeal } from './CancelledSeal';
import { Countdown } from './Countdown';
import { Corners } from './Frame';
import { PhaseBadge } from './PhaseBadge';
import { ScrambleText } from './ScrambleText';

export function LotCard({ lot, index }: { lot: LotSummary; index: number }) {
  const hasBids = lot.currentPriceCents !== null;
  const cancelled = lot.phase === 'cancelled';

  return (
    <Link
      to={`/lots/${lot.id}`}
      className="lot-item group/item relative block p-3 transition-opacity duration-200 focus-visible:outline-offset-4"
    >
      {}
      <Corners className="opacity-0 transition-opacity duration-200 group-hover/item:opacity-100 group-focus-visible/item:opacity-100" />

      <div className="relative overflow-hidden">
        <ArtImage src={lot.imageUrl} title={lot.title} width={400} className={`aspect-[4/5] w-full ${cancelled ? 'grayscale' : ''}`} />
        {cancelled && <CancelledSeal className="absolute left-3 top-3 bg-paper" />}
        <span
          aria-hidden="true"
          className="ui-label absolute bottom-3 right-3 bg-accent px-3 py-2 text-night opacity-0 transition-opacity duration-200 group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
        >
          Ver lote ↳
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="ui-label text-muted">[{String(index + 1).padStart(2, '0')}]</span>
        {!cancelled && (
          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {lot.phase === 'live' && <FinalStretchBadge endsAt={lot.endsAt} />}
            <PhaseBadge phase={lot.phase} />
          </span>
        )}
      </div>

      <h3 className="ui-display mt-2 line-clamp-2 text-xl leading-[1.05] md:text-2xl">
        <ScrambleText text={lot.title} />
      </h3>

      <dl className="ui-label mt-3 space-y-1 tabular-nums">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{hasBids ? (cancelled ? 'Último lance' : 'Lance atual') : 'Lance inicial'}</dt>
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

// Componente separado para só os cards ao vivo terem relógio próprio
function FinalStretchBadge({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const now = useNow(end);
  const left = end - now;
  if (left <= 0 || left > ANTI_SNIPING_WINDOW_MS) return null;
  return (
    <span className="ui-label inline-flex items-center whitespace-nowrap border border-accent px-2 py-0.5 text-ink">Reta final</span>
  );
}
