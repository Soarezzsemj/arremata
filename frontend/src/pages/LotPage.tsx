import { useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ArtImage } from '../components/ArtImage';
import { BidPanel, isLeading } from '../components/BidPanel';
import { Countdown } from '../components/Countdown';
import { Frame } from '../components/Frame';
import { PhaseBadge } from '../components/PhaseBadge';
import { SkeletonLine } from '../components/Skeleton';
import { Square } from '../components/Square';
import { apiGet, apiPost } from '../lib/api';
import { errorMessage, formatDateTime, formatMoney } from '../lib/format';
import { currentPath, withNext } from '../lib/next';
import type { LotSummary, LotView } from '../lib/types';
import { containerClass, errorClass, secondaryButtonClass } from '../lib/ui';
import { useLotEvents } from '../lib/useLotEvents';
import { walletQuery } from '../lib/wallet';

const backLinkClass = 'ui-label inline-flex min-h-11 items-center gap-2 hover:underline hover:decoration-accent hover:underline-offset-4';

const primaryLinkClass =
  'ui-label inline-flex min-h-14 w-full items-center justify-center gap-2 bg-accent px-6 text-night transition-opacity duration-150 hover:opacity-90';
 
const STREAM_POLL_MS = 15_000;

function pollInterval(lot: LotView, streaming: boolean): number | false {
  if (lot.phase === 'live') return streaming ? STREAM_POLL_MS : 3_000;
  if (lot.phase === 'scheduled') return streaming ? STREAM_POLL_MS : 5_000;
  if (lot.phase === 'ended' && lot.result === null) return 3_000;
  return false;
}


const END_REFETCH_DELAY_MS = 1_000;

const MAX_TIMEOUT_MS = 2_147_483_647;

export function LotPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();

  const lotKey = ['lot', id, user?.id ?? null] as const;
  const cachedPhase = queryClient.getQueryData<LotView>(lotKey)?.phase;
  const streaming = useLotEvents(id, cachedPhase !== 'cancelled');

  const lot = useQuery({
    queryKey: lotKey,
    queryFn: () => apiGet<LotView>(`/lots/${id}`),
    refetchInterval: (query) => (query.state.data ? pollInterval(query.state.data, streaming) : false),
    refetchIntervalInBackground: false,
  });

  
  const phase = lot.data?.phase;
  const endsAt = lot.data?.endsAt;
  useEffect(() => {
    if (phase !== 'live' || !endsAt) return;
    const delay = new Date(endsAt).getTime() - Date.now() + END_REFETCH_DELAY_MS;
    if (delay > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['lot', id] });
      queryClient.invalidateQueries({ queryKey: walletQuery.queryKey });
    }, Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [phase, endsAt, id, queryClient]);

  const cancel = useMutation({
    mutationFn: () => apiPost<LotSummary>(`/lots/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot'] });
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
    },
  });

  if (lot.isPending) {
    return (
      <div role="status" aria-label="Carregando lote" className={`${containerClass} grid gap-10 py-10 lg:grid-cols-[1.15fr_1fr]`}>
        <div className="aspect-[4/5] animate-pulse border border-line" />
        <div className="space-y-6 border-t border-line pt-6">
          <SkeletonLine className="w-24" />
          <SkeletonLine className="h-12 w-4/5" />
          <SkeletonLine className="h-10 w-1/2" />
          <SkeletonLine className="w-2/3" />
        </div>
      </div>
    );
  }
  if (lot.isError) {
    return (
      <div className={`${containerClass} py-16`}>
        <p className={errorClass}>{errorMessage(lot.error)}</p>
        <Link to="/" className={`${backLinkClass} mt-6`}>
          ↰ Voltar aos lotes
        </Link>
      </div>
    );
  }

  const data = lot.data;
  const canCancel = data.isOwner && data.bidCount === 0 && (data.phase === 'live' || data.phase === 'scheduled');
  const attributes = Object.entries(data.attributes);
  const leading = user?.role === 'BIDDER' && data.phase === 'live' && isLeading(data);

  return (
    <section className={`${containerClass} py-6 md:py-10`}>
      <Link to="/" className={backLinkClass}>
        ↰ Lotes
      </Link>

      <div className="mt-4 grid items-start gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        {}
        <Frame className="p-4 md:p-6 lg:sticky lg:top-6">
          <ArtImage
            src={data.imageUrl}
            title={data.title}
            width={843}
            loading="eager"
            fit="contain"
            className="mx-auto max-h-[80svh] w-full"
            fallbackClassName="aspect-[4/5]"
          />
        </Frame>

        <div className="divide-y divide-line border-y border-line">
          <div className="flex items-center justify-between gap-4 py-3">
            {}
            <span className="ui-label text-muted">Lote {data.id.slice(0, 8)}</span>
            <PhaseBadge phase={data.phase} />
          </div>

          <h1 className="ui-display py-6 text-[clamp(2.25rem,5.5vw,4.75rem)] leading-[0.92] [overflow-wrap:anywhere]">
            {data.title}
          </h1>

          <div className="py-6 tabular-nums">
            <p className="ui-label text-muted">{data.currentPriceCents !== null ? 'Lance atual' : 'Lance inicial'}</p>
            <p className="mt-2 font-mono text-[clamp(2.5rem,6vw,4.5rem)] leading-none tracking-tight">
              {formatMoney(data.currentPriceCents ?? data.startPriceCents)}
            </p>
            {leading && (
              <p className="ui-label mt-4 inline-flex items-center gap-2 border border-accent px-3 py-1.5 text-accent">
                <span aria-hidden="true" className="size-2 bg-accent" />
                Você está liderando
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 divide-x divide-line tabular-nums">
            {}
            {(data.phase === 'live' || data.phase === 'scheduled') && (
              <div className="py-4 pr-4">
                <dt className="ui-label text-muted">Próximo lance mínimo</dt>
                <dd className="mt-1 font-mono text-lg">{formatMoney(data.nextMinBidCents)}</dd>
              </div>
            )}
            <div className={data.phase === 'live' || data.phase === 'scheduled' ? 'py-4 pl-4' : 'py-4'}>
              <dt className="ui-label text-muted">Lances</dt>
              <dd className="mt-1 font-mono text-lg">{String(data.bidCount).padStart(2, '0')}</dd>
            </div>
          </dl>

          {(data.phase === 'live' || data.phase === 'scheduled') && (
            <p className="py-4 font-mono text-lg uppercase tabular-nums">
              <Countdown phase={data.phase} startsAt={data.startsAt} endsAt={data.endsAt} />
            </p>
          )}

          <p className="ui-label py-4 text-muted">
            {formatDateTime(data.startsAt)} até {formatDateTime(data.endsAt)}
          </p>

          {}
          {attributes.length > 0 && (
            <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-2 py-6 text-sm">
              {attributes.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="ui-label pt-0.5 text-muted">{key}</dt>
                  <dd className="font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {(data.phase === 'ended' || data.phase === 'cancelled') && <ResultBlock lot={data} />}

          {}
          {!authLoading && user?.role !== 'AUCTIONEER' &&
            (data.phase === 'scheduled' ? (
              <p className="ui-label py-6 text-muted">Leilão agendado: os lances abrem quando ele começar.</p>
            ) : data.phase !== 'live' ? null : user?.role === 'BIDDER' ? (
              <div>
                <BidPanel lot={data} queryKey={lotKey} />
                {data.viewer && (
                  <p className="pb-6 text-sm">
                    Neste lote você aparece como <strong>{data.viewer}</strong>.
                  </p>
                )}
              </div>
            ) : (
              <div className="py-6">
                <Link to={withNext('/login', currentPath(location))} className={primaryLinkClass}>
                  Entrar para dar lance ↳
                </Link>
              </div>
            ))}

          <BidList bids={data.bids} viewer={data.viewer} total={data.bidCount} />

          <p className="py-4">
            <Link to={`/auditoria/${data.id}`} className={backLinkClass}>
              <Square />
              Ver auditoria ↳
            </Link>
          </p>

          {canCancel && (
            <div className="space-y-3 py-6">
              <button
                type="button"
                disabled={cancel.isPending}
                onClick={() => {
                  if (confirm('Cancelar este lote?')) cancel.mutate();
                }}
                className={secondaryButtonClass}
              >
                Cancelar lote
              </button>
              {cancel.isError && <p className={errorClass}>{errorMessage(cancel.error)}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ResultBlock({ lot }: { lot: LotView }) {
  const { result } = lot;
  let content: ReactNode;

  if (lot.phase === 'cancelled') {
    content = <p className="ui-label">Lote cancelado</p>;
  } else if (result === null) {
    content = (
      <p className="ui-label inline-flex items-center gap-2">
        <span aria-hidden="true" className="size-2 animate-pulse bg-current" />
        Encerrado. Apurando resultado...
      </p>
    );
  } else if (result.outcome === 'unsold') {
    content = <p className="ui-label">Encerrado sem lances</p>;
  } else {
    const amount = formatMoney(result.amountCents);
    const participated = lot.viewer !== null && lot.bids.some((b) => b.bidder === lot.viewer);
    const receiptLink = result.receiptToken && (
      <Link to={`/comprovante/${result.receiptToken}`} className={`${primaryLinkClass} mt-5`}>
        Ver comprovante ↳
      </Link>
    );

    if (result.youWon) {
      content = (
        <>
          <p className="ui-label text-accent">Você arrematou este lote</p>
          <p className="mt-2 font-mono text-3xl tabular-nums text-accent">{amount}</p>
          {receiptLink}
        </>
      );
    } else if (lot.isOwner) {
      content = (
        <>
          <p className="ui-label">
            Vendido por <span className="font-mono tabular-nums">{amount}</span> para {result.winner}
          </p>
          {receiptLink}
        </>
      );
    } else if (participated) {
      content = (
        <p className="ui-label">
          Você não venceu este lote. Arrematado por {result.winner} por{' '}
          <span className="font-mono tabular-nums">{amount}</span>
        </p>
      );
    } else {
      content = (
        <p className="ui-label">
          Arrematado por {result.winner} por <span className="font-mono tabular-nums">{amount}</span>
        </p>
      );
    }
  }

  const won = result?.outcome === 'sold' && result.youWon;
  return (
    <div className="py-6">
      <Frame className={`px-5 py-5 ${won ? 'text-accent' : ''}`}>
        <h2 className="ui-label flex items-center gap-2 text-muted">
          <Square />
          Resultado
        </h2>
        <div role="status" aria-live="polite" className="mt-3 text-ink">
          {content}
        </div>
      </Frame>
    </div>
  );
}

function BidList({ bids, viewer, total }: { bids: LotView['bids']; viewer: string | null; total: number }) {
  return (
    <div className="py-6">
      <h2 className="ui-label flex items-center gap-2">
        Lances
        <span className="text-muted">[{String(total).padStart(2, '0')}]</span>
      </h2>
      {bids.length === 0 ? (
        <p className="ui-label mt-4 text-muted">Nenhum lance ainda</p>
      ) : (
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {[...bids]
            .sort((a, b) => b.seq - a.seq)
            .map((bid, i) => (
              <li key={bid.seq} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 py-3 tabular-nums">
                <span className="ui-label text-muted">[{String(bid.seq).padStart(2, '0')}]</span>
                <span className="min-w-0 text-sm">
                  {bid.bidder}
                  {bid.bidder === viewer && <span className="ui-label ml-2 text-accent">Você</span>}
                  <span className="ui-label block text-muted">
                    <time dateTime={bid.at}>{formatDateTime(bid.at)}</time>
                  </span>
                </span>
                <span className={`whitespace-nowrap text-right font-mono ${i === 0 ? '' : 'text-muted'}`}>
                  {formatMoney(bid.amountCents)}
                </span>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
