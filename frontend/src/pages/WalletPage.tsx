import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Frame } from '../components/Frame';
import { MoneyInput } from '../components/MoneyInput';
import { SkeletonLine } from '../components/Skeleton';
import { Square } from '../components/Square';
import { apiPost } from '../lib/api';
import { errorMessage, formatDateTime, formatMoney } from '../lib/format';
import type { LedgerType, Wallet } from '../lib/types';
import { containerClass, errorClass, secondaryButtonClass, textLinkClass } from '../lib/ui';
import { walletQuery } from '../lib/wallet';

const MIN_CENTS = 100;
const MAX_CENTS = 10_000_000;

const ledgerLabels: Record<LedgerType, string> = {
  DEPOSIT: 'Depósito',
  HOLD: 'Reserva em lance',
  RELEASE: 'Liberação de reserva',
  SETTLE_DEBIT: 'Débito do arremate',
  SETTLE_CREDIT: 'Crédito do arremate',
};

const credits: LedgerType[] = ['DEPOSIT', 'RELEASE', 'SETTLE_CREDIT'];

// Em centavos: R$ 100, R$ 500 e R$ 1.000
const quickAmounts = [10_000, 50_000, 100_000];

const primaryButtonClass =
  'ui-label inline-flex min-h-14 w-full items-center justify-center gap-2 bg-accent px-6 text-night transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-50';

// Fonte proporcional à largura da coluna (cqi) e ao número de caracteres, para o valor
// caber numa linha só. 0,65em é a largura aproximada de um caractere da fonte mono.
function Amount({ cents, max }: { cents: number; max: string }) {
  const text = formatMoney(cents);
  return (
    <p
      className="mt-2 whitespace-nowrap font-mono leading-none tracking-tight"
      style={{ fontSize: `clamp(0.875rem, calc(100cqi / ${(text.length * 0.65).toFixed(2)}), ${max})` }}
    >
      {text}
    </p>
  );
}

export function WalletPage() {
  const { user } = useAuth();
  const wallet = useQuery(walletQuery);

  return (
    <section className={`${containerClass} py-12 md:py-20`}>
      <p className="ui-label flex items-center gap-2 text-muted">
        <Square />
        Conta
      </p>
      <h1 className="ui-display mt-4 text-5xl leading-[0.9] md:text-6xl">Carteira</h1>

      {wallet.isPending && <WalletSkeleton />}

      {wallet.isError && (
        <div className="mt-10 space-y-6 border-t border-line pt-8">
          <p role="alert" className={errorClass}>
            {errorMessage(wallet.error)}
          </p>
          <button type="button" onClick={() => wallet.refetch()} className={secondaryButtonClass}>
            Tentar de novo
          </button>
        </div>
      )}

      {wallet.isSuccess && (
        <>
          <Balances data={wallet.data} />
          <div className={`mt-12 grid items-start gap-12 ${user?.role === 'BIDDER' ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : ''}`}>
            {user?.role === 'BIDDER' && <DepositForm />}
            <Movements data={wallet.data} />
          </div>
        </>
      )}
    </section>
  );
}

function Balances({ data }: { data: Wallet }) {
  return (
    <div className="mt-10 grid border-y border-line tabular-nums md:grid-cols-3 md:divide-x md:divide-line max-md:divide-y max-md:divide-line">
      <div className="@container min-w-0 py-6 md:pr-6">
        <p className="ui-label text-muted">Saldo total</p>
        <Amount cents={data.totalCents} max="2.75rem" />
      </div>
      <div className="@container min-w-0 py-6 md:px-6">
        <p className="ui-label text-muted">Comprometido</p>
        <Amount cents={data.committedCents} max="2.75rem" />
        <p className="ui-label mt-3 text-muted">Reservado nos lotes em que você lidera</p>
      </div>
      {/* Disponível é o que importa para dar lance: ganha moldura e tamanho maior */}
      <div className="min-w-0 py-4 md:pl-6">
        <Frame className="@container px-4 py-3">
          <p className="ui-label">Disponível</p>
          <Amount cents={data.availableCents} max="3.75rem" />
        </Frame>
      </div>
    </div>
  );
}

function DepositForm() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(0); // centavos
  const [clientError, setClientError] = useState('');
  const [done, setDone] = useState('');

  const deposit = useMutation({
    mutationFn: (amountCents: number) => apiPost<Wallet>('/me/wallet/deposit', { amountCents }),
    onSuccess: (data, amountCents) => {
      queryClient.setQueryData(walletQuery.queryKey, data);
      setAmount(0);
      setDone(`Depósito de ${formatMoney(amountCents)} confirmado.`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setDone('');
    deposit.reset();
    if (amount < MIN_CENTS) return setClientError(`O depósito mínimo é ${formatMoney(MIN_CENTS)}.`);
    if (amount > MAX_CENTS) return setClientError(`O depósito máximo é ${formatMoney(MAX_CENTS)}.`);
    setClientError('');
    deposit.mutate(amount);
  }

  function change(value: number) {
    setAmount(value);
    setClientError('');
    setDone('');
    deposit.reset();
  }

  const apiError = deposit.isError
    ? deposit.error && typeof deposit.error === 'object' && 'code' in deposit.error && deposit.error.code === 'WALLET_LIMIT'
      ? 'O saldo máximo da carteira foi atingido.'
      : errorMessage(deposit.error)
    : '';
  const error = clientError || apiError;

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="titulo-depositar" className="space-y-6 border-t border-ink pt-6">
      <h2 id="titulo-depositar" className="ui-label flex items-center gap-2">
        <Square />
        Depositar
      </h2>

      <div>
        <MoneyInput
          id="valor-deposito"
          label="Valor em reais"
          value={amount}
          onChange={change}
          maxCents={MAX_CENTS}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'dica-deposito erro-deposito' : 'dica-deposito'}
          className="text-lg"
        />
        <p id="dica-deposito" className="ui-label mt-2 text-muted">
          De {formatMoney(MIN_CENTS)} a {formatMoney(MAX_CENTS)}
        </p>
      </div>

      <div role="group" aria-label="Valores rápidos" className="grid grid-cols-3 gap-2">
        {quickAmounts.map((cents) => (
          <button key={cents} type="button" onClick={() => change(cents)} className={`${secondaryButtonClass} px-2`}>
            {formatMoney(cents).replace(',00', '')}
          </button>
        ))}
      </div>

      {error && (
        <p id="erro-deposito" role="alert" className={errorClass}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="ui-label">
          {done}
        </p>
      )}

      <button type="submit" disabled={deposit.isPending || amount < MIN_CENTS} className={primaryButtonClass}>
        {deposit.isPending ? 'Depositando...' : 'Depositar ↳'}
      </button>

      <p className="ui-label text-muted">Depósito simulado: nenhum dinheiro real é movimentado.</p>
    </form>
  );
}

function Movements({ data }: { data: Wallet }) {
  return (
    <div className="border-t border-ink pt-6">
      <h2 className="ui-label flex items-center gap-2">
        <Square />
        Movimentos
        <span className="text-muted">[{String(data.entries.length).padStart(2, '0')}]</span>
      </h2>

      {data.entries.length === 0 ? (
        <p className="ui-label mt-6 border border-line px-6 py-16 text-center text-muted">Nenhum movimento ainda</p>
      ) : (
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {data.entries.map((entry, i) => {
            const credit = credits.includes(entry.type);
            const label = ledgerLabels[entry.type] ?? entry.type;
            return (
              <li key={entry.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-1 py-3 tabular-nums">
                <span className="ui-label text-muted">[{String(i + 1).padStart(2, '0')}]</span>
                <span className="min-w-0">
                  {entry.lotId ? (
                    <Link to={`/lots/${entry.lotId}`} className={`${textLinkClass} text-sm`}>
                      {label}
                    </Link>
                  ) : (
                    <span className="text-sm">{label}</span>
                  )}
                  <span className="ui-label block text-muted">
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  </span>
                </span>
                <span className="whitespace-nowrap text-right font-mono">
                  <span className="sr-only">{credit ? 'Entrada de' : 'Saída de'} </span>
                  <span aria-hidden="true">{credit ? '+' : '-'} </span>
                  {formatMoney(entry.amountCents)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div role="status" aria-label="Carregando carteira" className="mt-10">
      <div className="grid gap-6 border-y border-line py-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <SkeletonLine className="w-24" />
            <SkeletonLine className="mt-3 h-10 w-3/4" />
          </div>
        ))}
      </div>
      <div className="mt-12 space-y-4 border-t border-line pt-6">
        <SkeletonLine className="w-28" />
        {[0, 1, 2, 3].map((i) => (
          <SkeletonLine key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
