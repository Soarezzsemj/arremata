import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Countdown } from '../components/Countdown';
import { PhaseBadge } from '../components/PhaseBadge';
import { apiGet, apiPost } from '../lib/api';
import { errorMessage, formatDateTime, formatMoney } from '../lib/format';
import type { LotSummary, LotView } from '../lib/types';
import { secondaryButtonClass } from '../lib/ui';

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

  if (lot.isPending) return <p className="py-8 text-slate-500">Carregando...</p>;
  if (lot.isError) return <p className="py-8 text-red-600 dark:text-red-400">{errorMessage(lot.error)}</p>;

  const data = lot.data;
  const canCancel = data.isOwner && data.bidCount === 0 && (data.phase === 'live' || data.phase === 'scheduled');

  return (
    <section className="grid gap-8 py-8 md:grid-cols-2">
      <div>
        {data.imageUrl ? (
          <img src={data.imageUrl} alt={data.title} className="w-full rounded-lg object-cover" />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
            Sem imagem
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <PhaseBadge phase={data.phase} />
        </div>

        {Object.keys(data.attributes).length > 0 && (
          <dl className="text-sm">
            {Object.entries(data.attributes).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="font-medium">{key}:</dt>
                <dd className="text-slate-600 dark:text-slate-400">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-sm text-slate-500">
            {data.currentPriceCents !== null ? 'Lance atual' : 'Lance inicial'}
          </p>
          <p className="text-3xl font-bold">{formatMoney(data.currentPriceCents ?? data.startPriceCents)}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Próximo lance mínimo: {formatMoney(data.nextMinBidCents)}
          </p>
          <p className="mt-2 text-sm">
            <Countdown phase={data.phase} startsAt={data.startsAt} endsAt={data.endsAt} />
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDateTime(data.startsAt)} até {formatDateTime(data.endsAt)} · {data.bidCount} lance(s)
          </p>
        </div>

        {user?.role === 'BIDDER' && typeof data.viewer === 'string' && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Neste lote você aparece como <strong>{data.viewer}</strong>.
          </p>
        )}

        {user?.role === 'BIDDER' && (
          <button type="button" disabled className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white opacity-50">
            Dar lance (em breve)
          </button>
        )}

        {canCancel && (
          <div>
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
            {cancel.isError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorMessage(cancel.error)}</p>}
          </div>
        )}
      </div>
    </section>
  );
}