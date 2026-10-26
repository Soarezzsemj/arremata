import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { LotCard } from '../components/LotCard';
import { apiGet } from '../lib/api';
import { errorMessage } from '../lib/format';
import type { LotSummary } from '../lib/types';

const filters = [
  { value: '', label: 'Todos' },
  { value: 'live', label: 'Ao vivo' },
  { value: 'scheduled', label: 'Agendados' },
  { value: 'ended', label: 'Encerrados' },
];

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const phase = params.get('phase') ?? '';

  const lots = useQuery({
    queryKey: ['lots', phase],
    queryFn: () =>
      apiGet<{ lots: LotSummary[]; serverTime: string }>(phase ? `/lots?phase=${phase}` : '/lots'),
    refetchInterval: 10_000,
  });

  return (
    <section className="py-8">
      <h1 className="text-2xl font-bold">Lotes</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setParams(f.value ? { phase: f.value } : {})}
            className={`rounded-full border px-3 py-1 text-sm ${
              phase === f.value
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {lots.isPending && <p className="mt-6 text-slate-500">Carregando lotes...</p>}
      {lots.isError && <p className="mt-6 text-red-600 dark:text-red-400">{errorMessage(lots.error)}</p>}
      {lots.isSuccess && lots.data.lots.length === 0 && <p className="mt-6 text-slate-500">Nenhum lote por aqui.</p>}
      {lots.isSuccess && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lots.data.lots.map((lot) => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </div>
      )}
    </section>
  );
}