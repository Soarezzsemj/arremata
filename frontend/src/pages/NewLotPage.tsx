import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/api';
import { errorMessage } from '../lib/format';
import type { ExternalItem, LotSummary } from '../lib/types';
import { ArtImage } from '../components/ArtImage';
import { Frame } from '../components/Frame';
import { MoneyInput } from '../components/MoneyInput';
import { SkeletonLine } from '../components/Skeleton';
import { Square } from '../components/Square';
import {
  buttonClass,
  containerClass,
  errorClass,
  fieldLabelClass,
  inputClass,
  secondaryButtonClass,
  textLinkClass,
} from '../lib/ui';


const MAX_LOT_CENTS = 1_000_000_000;

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NewLotPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<ExternalItem | null>(null);
  const [startPrice, setStartPrice] = useState(10_000);
  const [increment, setIncrement] = useState(500);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)));

  const search = useQuery({
    queryKey: ['search', term],
    queryFn: () => apiGet<{ items: ExternalItem[] }>(`/auctioneer/search?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
    retry: false,
  });

  const create = useMutation({
    mutationFn: (item: ExternalItem) =>
      apiPost<LotSummary>('/lots', {
        externalSource: item.externalSource,
        externalId: item.externalId,
        title: item.title,
        imageUrl: item.imageUrl,
        attributes: item.attributes,
        startPriceCents: startPrice,
        minIncrementCents: increment,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    onSuccess: (lot) => {
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      queryClient.invalidateQueries({ queryKey: ['auctioneer-lots'] });
      navigate(`/lots/${lot.id}`);
    },
  });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setTerm(q.trim());
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    create.mutate(selected);
  }

  return (
    <section className={`${containerClass} py-10 md:py-16`}>
      <p className="ui-label flex items-center gap-2 text-muted">
        <Square />
        Leiloeiro
      </p>
      <h1 className="ui-display mt-4 text-5xl leading-[0.9] md:text-7xl">Novo lote</h1>

      {!selected && (
        <>
          <form onSubmit={onSearch} className="mt-10 flex max-w-2xl flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-end">
            <label className={`${fieldLabelClass} flex-1`}>
              Buscar obra
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ex.: monet, water lilies"
                className={inputClass}
              />
            </label>
            <button type="submit" className={buttonClass}>
              Buscar ↳
            </button>
          </form>

          <div className="mt-10">
            {search.isFetching && search.data && <p className="ui-label mb-4 text-muted">Buscando...</p>}
            {search.isFetching && !search.data && (
              <div role="status" aria-label="Buscando obras" className="divide-y divide-line border-y border-line">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3">
                    <SkeletonLine className="w-8" />
                    <span className="size-16 animate-pulse bg-line" />
                    <SkeletonLine className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            )}
            {search.isError && <p className={errorClass}>{errorMessage(search.error)}</p>}
            {search.isSuccess && search.data.items.length === 0 && (
              <p className="ui-label border border-line px-6 py-12 text-center text-muted">Nada encontrado</p>
            )}

            {search.data && search.data.items.length > 0 && (
              <ol className="divide-y divide-line border-y border-line">
                {search.data.items.map((item, i) => (
                  <li key={item.externalId} className="grid grid-cols-[auto_4rem_1fr] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[auto_4rem_1fr_auto]">
                    <span className="ui-label text-muted">[{String(i + 1).padStart(2, '0')}]</span>
                    <ArtImage src={item.imageUrl} title={item.title} width={200} className="size-16" />
                    <div className="min-w-0">
                      <p className="ui-display line-clamp-2 text-lg leading-tight">{item.title}</p>
                      {item.attributes.Artista && <p className="mt-1 truncate text-sm text-muted">{item.attributes.Artista}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className={`${secondaryButtonClass} col-span-3 sm:col-span-1`}
                    >
                      Selecionar ↳
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}

      {selected && (
        <form onSubmit={onCreate} className="mt-10 grid gap-10 border-t border-line pt-8 md:grid-cols-[minmax(0,20rem)_minmax(0,28rem)]">
          <div>
            <p className="ui-label text-muted">Obra escolhida</p>
            <Frame className="mt-3 p-3">
              <ArtImage src={selected.imageUrl} title={selected.title} width={400} className="aspect-[4/5] w-full" />
            </Frame>
            <p className="ui-display mt-4 text-2xl leading-tight">{selected.title}</p>
            <button type="button" onClick={() => setSelected(null)} className={`ui-label mt-2 min-h-11 ${textLinkClass}`}>
              Trocar obra
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <MoneyInput id="preco-inicial" label="Preço inicial" value={startPrice} onChange={setStartPrice} maxCents={MAX_LOT_CENTS} />
              </div>
              <div>
                <MoneyInput id="incremento-minimo" label="Incremento mínimo" value={increment} onChange={setIncrement} maxCents={MAX_LOT_CENTS} />
              </div>
              <label className={fieldLabelClass}>
                Início
                <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
              </label>
              <label className={fieldLabelClass}>
                Fim
                <input type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
              </label>
            </div>
            {create.isError && (
              <p role="alert" className={errorClass}>
                {errorMessage(create.error)}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={create.isPending} className={buttonClass}>
                {create.isPending ? 'Criando...' : 'Criar lote ↳'}
              </button>
              <button type="button" onClick={() => setSelected(null)} className={secondaryButtonClass}>
                Voltar
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
