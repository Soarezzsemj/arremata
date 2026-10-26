import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ArtImage } from '../components/ArtImage';
import { Countdown } from '../components/Countdown';
import { Frame } from '../components/Frame';
import { PhaseBadge } from '../components/PhaseBadge';
import { SkeletonLine } from '../components/Skeleton';
import { apiGet, apiPost } from '../lib/api';
import { errorMessage, formatDateTime, formatMoney } from '../lib/format';
import type { LotSummary, LotView } from '../lib/types';
import { containerClass, errorClass, secondaryButtonClass } from '../lib/ui';

const backLinkClass = 'ui-label inline-flex min-h-11 items-center gap-2 hover:underline hover:decoration-accent hover:underline-offset-4';

export function LotPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const lot = useQuery({
    queryKey: ['lot', id, user?.id ?? null],
    queryFn: () => apiGet<LotView>(`/lots/${id}`),
    refetchInterval: 5_000,
  });

  const cancel = useMutation({
    mutationFn: () => apiPost<LotSummary>(`/lots/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot'] });
      queryClient.invalidateQueries({ queryKey: ['lots'] });
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
          </div>

          <dl className="grid grid-cols-2 divide-x divide-line tabular-nums">
            <div className="py-4 pr-4">
              <dt className="ui-label text-muted">Próximo lance mínimo</dt>
              <dd className="mt-1 font-mono text-lg">{formatMoney(data.nextMinBidCents)}</dd>
            </div>
            <div className="py-4 pl-4">
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

          {/* Atributos como legenda de museu */}
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

          {user?.role === 'BIDDER' && (
            <div className="space-y-4 py-6">
              {typeof data.viewer === 'string' && (
                <p className="text-sm">
                  Neste lote você aparece como <strong>{data.viewer}</strong>.
                </p>
              )}
              <button
                type="button"
                disabled
                className="ui-label inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 bg-accent px-6 text-night opacity-60"
              >
                Dar lance (em breve) ↳
              </button>
            </div>
          )}

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
