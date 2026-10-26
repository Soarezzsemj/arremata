import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ArtImage } from '../components/ArtImage';
import { Countdown } from '../components/Countdown';
import { Corners } from '../components/Frame';
import { LotCard } from '../components/LotCard';
import { LotGridSkeleton, SkeletonLine } from '../components/Skeleton';
import { ScrambleText } from '../components/ScrambleText';
import { Square } from '../components/Square';
import { apiGet } from '../lib/api';
import { errorMessage, formatMoney } from '../lib/format';
import type { LotSummary } from '../lib/types';
import { containerClass, errorClass } from '../lib/ui';

const filters = [
  { value: '', label: 'Todos', empty: 'Nenhum lote por aqui' },
  { value: 'live', label: 'Ao vivo', empty: 'Nenhum lote ao vivo agora' },
  { value: 'scheduled', label: 'Agendados', empty: 'Nenhum lote agendado' },
  { value: 'ended', label: 'Encerrados', empty: 'Nenhum lote encerrado' },
];

type LotsResponse = { lots: LotSummary[]; serverTime: string };

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const phase = params.get('phase') ?? '';

  const lots = useQuery({
    queryKey: ['lots', phase],
    queryFn: () =>
      apiGet<{ lots: LotSummary[]; serverTime: string }>(phase ? `/lots?phase=${phase}` : '/lots'),
    refetchInterval: 10_000,
  });

  const live = useQuery({
    queryKey: ['lots', 'live'],
    queryFn: () => apiGet<LotsResponse>('/lots?phase=live'),
    refetchInterval: 10_000,
  });
  const endingSoon = [...(live.data?.lots ?? [])].sort(
    (a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime(),
  );

  const current = filters.find((f) => f.value === phase) ?? filters[0];

  return (
    <>
      <h1 className="sr-only">Arremata: leilões de obras de arte</h1>
      <Hero pending={live.isPending} first={endingSoon[0]} next={endingSoon[1]} />

      <section aria-labelledby="titulo-lotes" className={`${containerClass} mt-16 md:mt-24`}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-4">
          <h2 id="titulo-lotes" className="ui-label flex items-center gap-2">
            <Square />
            Lotes
            {lots.isSuccess && <span className="text-muted">[{String(lots.data.lots.length).padStart(2, '0')}]</span>}
          </h2>

          <div role="group" aria-label="Filtrar por fase" className="flex flex-wrap gap-x-6">
            {filters.map((f, i) => (
              <span key={f.value} className="inline-flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setParams(f.value ? { phase: f.value } : {})}
                  aria-pressed={phase === f.value}
                  className={`ui-label inline-flex min-h-11 items-center transition-colors duration-150 ${
                    phase === f.value ? 'underline decoration-1 underline-offset-4' : 'text-muted hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
                {/* Separador fora do botão para não herdar o sublinhado do filtro ativo */}
                {i < filters.length - 1 && (
                  <span aria-hidden="true" className="ui-label text-muted">
                    /
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {lots.isPending && <LotGridSkeleton />}
          {lots.isError && <p className={errorClass}>{errorMessage(lots.error)}</p>}
          {lots.isSuccess && lots.data.lots.length === 0 && (
            <p className="ui-label border border-line px-6 py-16 text-center text-muted">{current.empty}</p>
          )}
          {lots.isSuccess && lots.data.lots.length > 0 && (
            <div className="lot-list -mx-3 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {lots.data.lots.map((lot, i) => (
                <LotCard key={lot.id} lot={lot} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Hero({ pending, first, next }: { pending: boolean; first?: LotSummary; next?: LotSummary }) {
  if (pending) {
    return (
      <div className={`${containerClass} mt-10`}>
        <div role="status" aria-label="Carregando destaque" className="flex min-h-[60svh] flex-col justify-end border border-line p-6 md:p-10">
          <SkeletonLine className="w-32" />
          <SkeletonLine className="mt-6 h-14 w-3/4" />
          <SkeletonLine className="mt-4 h-6 w-40" />
        </div>
      </div>
    );
  }

  if (!first) {
    return (
      <section aria-label="Destaque" className={`${containerClass} mt-10`}>
        <div className="relative px-6 py-16 md:px-10 md:py-24">
          <Corners />
          <p className="ui-label flex items-center gap-2 text-muted">
            <Square />
            Nenhum lote ao vivo agora
          </p>
          <h2 className="ui-display mt-6 text-[clamp(3rem,11vw,10rem)] leading-[0.88]">Obras em leilão</h2>
          <p className="ui-blurb mt-8 max-w-sm">
            Peças do acervo do Art Institute of Chicago, com lances em reais e prazo marcado.
          </p>
          <Link to="/?phase=scheduled" className="ui-label mt-8 inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline hover:decoration-accent">
            Ver agendados ↳
          </Link>
        </div>
      </section>
    );
  }

  const hasBids = first.currentPriceCents !== null;

  return (
    <section aria-label="Destaque: lote ao vivo que termina primeiro" className="relative mt-6 min-h-[78svh] overflow-hidden bg-night text-snow">
      <ArtImage src={first.imageUrl} title={first.title} width={843} loading="eager" className="absolute inset-0 h-full w-full" />
      {}
      <div aria-hidden="true" className="absolute inset-0 bg-night/55" />

      <div className={`${containerClass} relative flex min-h-[78svh] flex-col justify-end gap-10 py-10 md:py-14`}>
        <div className="max-w-5xl">
          <p className="ui-label flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 bg-accent px-2 py-1 text-night">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-night" />
              Ao vivo
            </span>
            <span>Termina primeiro</span>
          </p>
          <h2 className="ui-display mt-5 line-clamp-3 text-[clamp(2.5rem,8vw,7.5rem)] leading-[0.9]">{first.title}</h2>

          <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 tabular-nums">
            <div>
              <dt className="ui-label">{hasBids ? 'Lance atual' : 'Lance inicial'}</dt>
              <dd className="mt-1 font-mono text-3xl md:text-4xl">{formatMoney(first.currentPriceCents ?? first.startPriceCents)}</dd>
            </div>
            <div>
              <dt className="ui-label">Tempo</dt>
              <dd className="mt-1 font-mono text-base uppercase md:text-lg">
                <Countdown phase={first.phase} startsAt={first.startsAt} endsAt={first.endsAt} />
              </dd>
            </div>
          </dl>

          <Link
            to={`/lots/${first.id}`}
            className="ui-label mt-8 inline-flex min-h-11 items-center gap-2 border border-snow px-5 transition-colors duration-200 hover:border-accent hover:bg-accent hover:text-night"
          >
            Ver lote ↳
          </Link>
        </div>

        {next && (
          <Link
            to={`/lots/${next.id}`}
            className="group relative flex max-w-sm gap-4 self-end bg-night/70 p-3 transition-colors duration-200 hover:bg-night/90"
          >
            <Corners />
            <ArtImage src={next.imageUrl} title={next.title} width={200} className="size-20 shrink-0" />
            <span className="flex min-w-0 flex-col justify-between">
              <span className="ui-label flex items-center gap-2 opacity-80">
                <Square />
                Próximo a terminar
              </span>
              <span className="ui-display line-clamp-2 text-base leading-tight">
                <ScrambleText text={next.title} />
              </span>
              <span className="ui-label tabular-nums">
                <Countdown phase={next.phase} startsAt={next.startsAt} endsAt={next.endsAt} />
              </span>
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}
