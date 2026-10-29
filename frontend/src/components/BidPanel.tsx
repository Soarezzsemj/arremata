import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { apiPost, type ApiError } from '../lib/api';
import { errorMessage, formatDateTime, formatMoney } from '../lib/format';
import type { LotView, PlaceBidResponse } from '../lib/types';
import { errorClass, secondaryButtonClass, textLinkClass } from '../lib/ui';
import { walletQuery } from '../lib/wallet';
import { Frame } from './Frame';
import { MoneyInput } from './MoneyInput';
import { Square } from './Square';

const primaryButtonClass =
  'ui-label inline-flex min-h-14 w-full items-center justify-center gap-2 bg-accent px-6 text-night transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-50';

const STALE_CODES = ['BELOW_MIN', 'ALREADY_LEADING', 'ENDED', 'NOT_STARTED', 'LOT_CANCELLED'];

export function minBidCents(lot: Pick<LotView, 'bidCount' | 'startPriceCents' | 'currentPriceCents' | 'minIncrementCents'>) {
  return lot.bidCount === 0 ? lot.startPriceCents : (lot.currentPriceCents ?? lot.startPriceCents) + lot.minIncrementCents;
}

export function isLeading(lot: Pick<LotView, 'leader' | 'viewer'>) {
  return lot.viewer !== null && lot.leader === lot.viewer;
}

function asApiError(err: unknown): ApiError | null {
  return err && typeof err === 'object' && 'code' in err ? (err as ApiError) : null;
}

function detailCents(err: ApiError, key: string): number | null {
  const value = err.details?.[key];
  return typeof value === 'number' ? value : null;
}

function bidErrorMessage(err: unknown): ReactNode {
  const apiError = asApiError(err);
  switch (apiError?.code) {
    case 'BELOW_MIN': {
      const min = detailCents(apiError, 'minCents');
      return min !== null ? `O lance mínimo agora é ${formatMoney(min)}.` : 'O lance ficou abaixo do mínimo.';
    }
    case 'INSUFFICIENT_FUNDS': {
      const available = detailCents(apiError, 'availableCents');
      return (
        <>
          Saldo insuficiente{available !== null && <> (disponível: {formatMoney(available)})</>}.{' '}
          <Link to="/carteira" className={textLinkClass}>
            Depositar na carteira
          </Link>
        </>
      );
    }
    case 'ALREADY_LEADING':
      return 'Você já está liderando este lote.';
    case 'ENDED':
      return 'Este leilão já encerrou.';
    case 'NOT_STARTED':
      return 'Este leilão ainda não começou.';
    case 'LOT_CANCELLED':
      return 'Este lote foi cancelado.';
    case 'FORBIDDEN_ROLE':
      return 'Só licitantes podem dar lance.';
    case 'UNAUTHORIZED':
      return (
        <>
          Sua sessão expirou.{' '}
          <Link to="/login" className={textLinkClass}>
            Entrar de novo
          </Link>
        </>
      );
    default:
      return errorMessage(err);
  }
}

export function BidPanel({ lot, queryKey }: { lot: LotView; queryKey: readonly unknown[] }) {
  const queryClient = useQueryClient();
  const wallet = useQuery(walletQuery);
 
  const [typed, setTyped] = useState<number | null>(null);
  const [done, setDone] = useState<{ amountCents: number; extended: boolean } | null>(null);

  const min = minBidCents(lot);
  const amount = typed ?? min;
  const available = wallet.data?.availableCents ?? null;
  const leading = isLeading(lot);

  const bid = useMutation({
    mutationFn: (amountCents: number) => apiPost<PlaceBidResponse>(`/lots/${lot.id}/bids`, { amountCents }),
    onSuccess: (res) => {
      queryClient.setQueryData<LotView>(queryKey, (old) =>
        old && {
          ...old,
          currentPriceCents: res.lot.currentPriceCents,
          bidCount: res.lot.bidCount,
          endsAt: res.lot.endsAt,
          nextMinBidCents: res.lot.currentPriceCents + old.minIncrementCents,
          leader: old.viewer,
          bids: old.viewer
            ? [{ seq: res.bid.seq, bidder: old.viewer, amountCents: res.bid.amountCents, at: res.bid.createdAt }, ...old.bids]
            : old.bids,
        },
      );
      queryClient.invalidateQueries({ queryKey: ['lot', lot.id] });
      queryClient.invalidateQueries({ queryKey: walletQuery.queryKey });
      queryClient.invalidateQueries({ queryKey: ['my-bids'] });
      setTyped(null);
      setDone({ amountCents: res.bid.amountCents, extended: res.extended });
    },
    onError: (err) => {
      const code = asApiError(err)?.code;
      if (code && STALE_CODES.includes(code)) queryClient.invalidateQueries({ queryKey: ['lot', lot.id] });
      if (code === 'INSUFFICIENT_FUNDS') queryClient.invalidateQueries({ queryKey: walletQuery.queryKey });
    },
  });

  let blocked = '';
  if (leading) blocked = 'Você já está liderando este lote.';
  else if (amount < min) blocked = `Abaixo do lance mínimo de ${formatMoney(min)}.`;
  else if (available !== null && amount > available) blocked = `Acima do seu saldo disponível de ${formatMoney(available)}.`;

  function change(value: number) {
    setTyped(value);
    setDone(null);
    bid.reset();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (blocked || bid.isPending) return;
    setDone(null);
    bid.mutate(amount);
  }

  const describedBy = ['dica-lance', blocked && 'motivo-lance', bid.isError && 'erro-lance'].filter(Boolean).join(' ');

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="titulo-lance" className="space-y-5 py-6">
      <h2 id="titulo-lance" className="ui-label flex items-center gap-2">
        <Square className="text-accent" />
        Dar lance
      </h2>

      <dl className="grid grid-cols-2 tabular-nums">
        <div className="py-1 pr-4">
          <dt className="ui-label text-muted">Lance mínimo</dt>
          <dd className="mt-1 font-mono text-lg">{formatMoney(min)}</dd>
        </div>
        <Frame className="px-4 py-1">
          <dt className="ui-label text-muted">Saldo disponível</dt>
          <dd className="mt-1 font-mono text-lg">
            {wallet.isPending ? '...' : available !== null ? formatMoney(available) : '—'}
          </dd>
        </Frame>
      </dl>

      <div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <MoneyInput
              id="valor-lance"
              label="Seu lance"
              value={amount}
              onChange={change}
              disabled={bid.isPending}
              aria-invalid={(!!blocked && !leading) || undefined}
              aria-describedby={describedBy}
              className="text-lg"
            />
          </div>
          <button type="button" onClick={() => change(min)} disabled={bid.isPending} className={`${secondaryButtonClass} px-3`}>
            Lance mínimo
          </button>
        </div>
        <p id="dica-lance" className="ui-label mt-2 text-muted">
          Incremento mínimo de {formatMoney(lot.minIncrementCents)}
        </p>
      </div>

      {blocked && (
        <p id="motivo-lance" className="ui-label text-muted">
          {blocked}
        </p>
      )}

      {bid.isError && (
        <p id="erro-lance" role="alert" className={errorClass}>
          {bidErrorMessage(bid.error)}
        </p>
      )}

      {done && (
        <div role="status" className="space-y-1">
          <p className="ui-label">Lance de {formatMoney(done.amountCents)} registrado.</p>
          {done.extended && (
            <p className="ui-label text-accent">Leilão prorrogado: +2 minutos (até {formatDateTime(lot.endsAt)})</p>
          )}
        </div>
      )}

      <button type="submit" disabled={!!blocked || bid.isPending} aria-busy={bid.isPending || undefined} className={primaryButtonClass}>
        {bid.isPending ? 'Enviando...' : 'Dar lance ↳'}
      </button>
    </form>
  );
}
