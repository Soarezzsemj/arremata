import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/api';
import { errorMessage } from '../lib/format';
import type { ExternalItem, LotSummary } from '../lib/types';
import { buttonClass, inputClass, secondaryButtonClass } from '../lib/ui';

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toCents(value: string): number {
  return Math.round(parseFloat(value.replace(',', '.')) * 100);
}

export function NewLotPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<ExternalItem | null>(null);

  const [startPrice, setStartPrice] = useState('100');
  const [increment, setIncrement] = useState('5');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [formError, setFormError] = useState('');

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
        startPriceCents: toCents(startPrice),
        minIncrementCents: toCents(increment),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    onSuccess: (lot) => {
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      navigate(`/lots/${lot.id}`);
    },
  });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setTerm(q.trim());
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!selected) return;
    if (Number.isNaN(toCents(startPrice)) || Number.isNaN(toCents(increment))) {
      setFormError('Preencha os valores em reais (ex.: 100 ou 99,90).');
      return;
    }
    create.mutate(selected);
  }

  return (
    <section className="py-8">
      <h1 className="text-2xl font-bold">Novo lote</h1>

      {!selected && (
        <>
          <form onSubmit={onSearch} className="mt-4 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar obra (ex.: monet, water lilies)"
              className={inputClass}
            />
            <button type="submit" className={buttonClass}>
              Buscar
            </button>
          </form>

          {search.isFetching && <p className="mt-4 text-slate-500">Buscando...</p>}
          {search.isError && <p className="mt-4 text-red-600 dark:text-red-400">{errorMessage(search.error)}</p>}
          {search.isSuccess && search.data.items.length === 0 && <p className="mt-4 text-slate-500">Nada encontrado.</p>}

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {search.data?.items.map((item) => (
              <li key={item.externalId} className="flex gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {item.imageUrl && <img src={item.imageUrl} alt="" className="h-20 w-20 rounded object-cover" />}
                <div className="flex-1 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-slate-500">{item.attributes.Artista}</p>
                  <button type="button" onClick={() => setSelected(item)} className="mt-1 text-indigo-600 hover:underline dark:text-indigo-400">
                    Selecionar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && (
        <form onSubmit={onCreate} className="mt-4 max-w-md space-y-4">
          <p className="text-sm">
            Obra escolhida: <strong>{selected.title}</strong>{' '}
            <button type="button" onClick={() => setSelected(null)} className="text-indigo-600 hover:underline dark:text-indigo-400">
              trocar
            </button>
          </p>
          <label className="block text-sm">
            Preço inicial (R$)
            <input required value={startPrice} onChange={(e) => setStartPrice(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm">
            Incremento mínimo (R$)
            <input required value={increment} onChange={(e) => setIncrement(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm">
            Início
            <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm">
            Fim
            <input type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </label>
          {(formError || create.isError) && (
            <p className="text-sm text-red-600 dark:text-red-400">{formError || errorMessage(create.error)}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending} className={buttonClass}>
              {create.isPending ? 'Criando...' : 'Criar lote'}
            </button>
            <button type="button" onClick={() => setSelected(null)} className={secondaryButtonClass}>
              Voltar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}