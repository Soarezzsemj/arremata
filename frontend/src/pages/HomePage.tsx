import { useEffect, useId, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
import type { ListPhase, LotSort, LotsPage, LotSummary } from '../lib/types';
import { containerClass, errorClass, inputClass, secondaryButtonClass } from '../lib/ui';

const filters: { value: ListPhase | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'live', label: 'Ao vivo' },
  { value: 'scheduled', label: 'Agendados' },
  { value: 'ended', label: 'Encerrados' },
];

const sorts: { value: LotSort; label: string }[] = [
  { value: 'ending', label: 'Termina primeiro' },
  { value: 'newest', label: 'Mais recentes' },
  { value: 'bids', label: 'Mais lances' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
];

const DEFAULT_SORT: LotSort = 'ending';
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;
const MAX_QUERY_LENGTH = 100;

type ListParams = { phase: ListPhase | ''; sort: LotSort; q: string };

function normalizeQuery(value: string | null) {
  return (value ?? '').trim().slice(0, MAX_QUERY_LENGTH);
}

function readListParams(params: URLSearchParams): ListParams {
  const rawPhase = params.get('phase');
  const rawSort = params.get('sort');
  return {
    phase: filters.find((f) => f.value !== '' && f.value === rawPhase)?.value ?? '',
    sort: sorts.find((s) => s.value === rawSort)?.value ?? DEFAULT_SORT,
    q: normalizeQuery(params.get('q')),
  };
}

function lotsPath({ phase, sort, q }: ListParams, page: number) {
  const search = new URLSearchParams({ sort, page: String(page), limit: String(PAGE_SIZE) });
  if (phase) search.set('phase', phase);
  if (q) search.set('q', q);
  return `/lots?${search}`;
}

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const { phase, sort, q } = readListParams(params);

  function updateParams(changes: Partial<ListParams>) {
    setParams(
      (prev) => {
        const next = { ...readListParams(prev), ...changes };
        const out = new URLSearchParams();
        if (next.q) out.set('q', next.q);
        if (next.sort !== DEFAULT_SORT) out.set('sort', next.sort);
        if (next.phase) out.set('phase', next.phase);
        return out;
      },
      { replace: 'q' in changes },
    );
  }

  const [text, setText] = useState(q);

  useEffect(() => {
    setText((prev) => (normalizeQuery(prev) === q ? prev : q));
  }, [q]);

  useEffect(() => {
    const next = normalizeQuery(text);
    if (next === q) return;
    const timer = setTimeout(() => updateParams({ q: next }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, q]);

  function clearSearch() {
    setText('');
    updateParams({ q: '' });
  }

  const lots = useInfiniteQuery({
    queryKey: ['lots', 'list', { phase, sort, q }],
    queryFn: ({ pageParam }) => apiGet<LotsPage>(lotsPath({ phase, sort, q }, pageParam)),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  });

  const seen = new Set<string>();
  const items = (lots.data?.pages ?? [])
    .flatMap((p) => p.lots)
    .filter((lot) => {
      if (seen.has(lot.id)) return false;
      seen.add(lot.id);
      return true;
    });
  const total = lots.data?.pages[0]?.total;

  const live = useQuery({
    queryKey: ['lots', 'hero'],
    queryFn: () => apiGet<LotsPage>('/lots?phase=live&sort=ending&limit=2'),
    refetchInterval: 10_000,
  });

  const searchId = useId();
  const sortId = useId();

  return (
    <>
      <h1 className="sr-only">Arremata: leilões de obras de arte</h1>
      <Hero pending={live.isPending} first={live.data?.lots[0]} next={live.data?.lots[1]} />

      <section aria-labelledby="titulo-lotes" className={`${containerClass} mt-16 md:mt-24`}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-4">
          <h2 id="titulo-lotes" className="ui-label flex items-center gap-2">
            <Square />
            Lotes
            {total !== undefined && <span className="text-muted">[{total === 1 ? '1 lote' : `${total} lotes`}]</span>}
          </h2>

          <div role="group" aria-label="Filtrar por fase" className="flex flex-wrap gap-x-6">
            {filters.map((f, i) => (
              <span key={f.value} className="inline-flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => updateParams({ phase: f.value })}
                  aria-pressed={phase === f.value}
                  className={`ui-label inline-flex min-h-11 items-center transition-colors duration-150 ${
                    phase === f.value ? 'underline decoration-1 underline-offset-4' : 'text-muted hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
                {}
                {i < filters.length - 1 && (
                  <span aria-hidden="true" className="ui-label text-muted">
                    /
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div role="search" className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
          <div>
            <label htmlFor={searchId} className="ui-label block">
              Buscar por título
            </label>
            <input
              id={searchId}
              type="search"
              value={text}
              maxLength={MAX_QUERY_LENGTH}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex.: paisagem, retrato"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={sortId} className="ui-label block">
              Ordenar por
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value as LotSort })}
              className={inputClass}
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8" aria-busy={lots.isFetching && !lots.isFetchingNextPage}>
          {lots.isPending && <LotGridSkeleton />}

          {lots.isError && !lots.data && (
            <div className="space-y-6">
              <p role="alert" className={errorClass}>
                {errorMessage(lots.error)}
              </p>
              <button type="button" onClick={() => lots.refetch()} className={secondaryButtonClass}>
                Tentar de novo
              </button>
            </div>
          )}

          {lots.data && items.length === 0 && (
            <div role="status" className="border border-line px-6 py-16 text-center">
              <p className="ui-label text-muted">
                Nenhum lote encontrado{q && <> para “{q}”</>}
              </p>
              {q && (
                <button type="button" onClick={clearSearch} className={`${secondaryButtonClass} mt-6`}>
                  Limpar busca
                </button>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div
              className={`lot-list -mx-3 grid gap-x-6 gap-y-10 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-4 ${
                lots.isPlaceholderData ? 'opacity-60' : ''
              }`}
            >
              {items.map((lot, i) => (
                <LotCard key={lot.id} lot={lot} index={i} />
              ))}
            </div>
          )}

          {lots.data && lots.isRefetchError && (
            <p role="alert" className={`${errorClass} mt-8`}>
              Não foi possível atualizar a lista: {errorMessage(lots.error)}
            </p>
          )}

          {lots.isFetchNextPageError && (
            <p role="alert" className={`${errorClass} mt-8`}>
              Não foi possível carregar mais lotes: {errorMessage(lots.error)}
            </p>
          )}

          {lots.hasNextPage && !lots.isPlaceholderData && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={() => lots.fetchNextPage()}
                disabled={lots.isFetchingNextPage}
                className={secondaryButtonClass}
              >
                {lots.isFetchingNextPage ? 'Carregando...' : lots.isFetchNextPageError ? 'Tentar de novo' : 'Carregar mais'}
              </button>
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
