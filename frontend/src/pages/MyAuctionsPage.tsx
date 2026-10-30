import type { ReactNode } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ArtImage } from '../components/ArtImage';
import { CancelledSeal } from '../components/CancelledSeal';
import { Countdown } from '../components/Countdown';
import { PhaseBadge } from '../components/PhaseBadge';
import { SkeletonLine } from '../components/Skeleton';
import { Square } from '../components/Square';
import { apiGet } from '../lib/api';
import { errorMessage, formatMoney } from '../lib/format';
import type { AuctioneerLot, AuctioneerLotsResponse, BidStanding, LotSummary, MyBidLot, MyBidsResponse } from '../lib/types';
import { containerClass, errorClass, secondaryButtonClass, textLinkClass } from '../lib/ui';

const itemLinkClass = 'ui-label inline-flex min-h-11 items-center gap-2 hover:underline hover:decoration-accent hover:underline-offset-4';

const ACTIVE_REFETCH_MS = 30_000;

function isActive(lot: LotSummary) {
  return lot.phase === 'live' || lot.phase === 'scheduled';
}

const time = (iso: string) => new Date(iso).getTime();
const endsFirst = (a: LotSummary, b: LotSummary) => time(a.endsAt) - time(b.endsAt);
const newestFirst = (a: LotSummary, b: LotSummary) => time(b.endsAt) - time(a.endsAt);

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function MyAuctionsPage() {
  const { user } = useAuth();

  return (
    <section className={`${containerClass} py-12 md:py-20`}>
      <p className="ui-label flex items-center gap-2 text-muted">
        <Square />
        Conta
      </p>
      <h1 className="ui-display mt-4 text-5xl leading-[0.9] md:text-6xl">Meus leilões</h1>
      {user?.role === 'AUCTIONEER' ? <AuctioneerLots /> : <BidderLots />}
    </section>
  );
}

function BidderLots() {
  const query = useQuery({
    queryKey: ['my-bids'],
    queryFn: () => apiGet<MyBidsResponse>('/me/bids'),
    refetchInterval: (q) => (q.state.data?.lots.some(isActive) ? ACTIVE_REFETCH_MS : false),
  });

  return (
    <ListState
      query={query}
      empty={
        <>
          Você ainda não deu nenhum lance.{' '}
          <Link to="/?phase=live" className={textLinkClass}>
            Ver lotes ao vivo
          </Link>
        </>
      }
    >
      {(lots) => (
        <>
          <Section title="Em andamento" lots={lots.filter(isActive).sort(endsFirst)} emptyText="Nenhum leilão em andamento.">
            {(lot) => <BidderItem lot={lot} />}
          </Section>
          <Section title="Encerrados" lots={lots.filter((l) => !isActive(l)).sort(newestFirst)} emptyText="Nenhum leilão encerrado.">
            {(lot) => <BidderItem lot={lot} />}
          </Section>
        </>
      )}
    </ListState>
  );
}

function AuctioneerLots() {
  const query = useQuery({
    queryKey: ['auctioneer-lots'],
    queryFn: () => apiGet<AuctioneerLotsResponse>('/auctioneer/lots'),
    refetchInterval: (q) => (q.state.data?.lots.some(isActive) ? ACTIVE_REFETCH_MS : false),
  });

  return (
    <ListState
      query={query}
      empty={
        <>
          Você ainda não criou nenhum lote.{' '}
          <Link to="/auctioneer/new" className={textLinkClass}>
            Criar lote
          </Link>
        </>
      }
    >
      {(lots) => (
        <>
          <Section title="Ao vivo / Agendados" lots={lots.filter(isActive).sort(endsFirst)} emptyText="Nenhum lote ao vivo ou agendado.">
            {(lot) => <AuctioneerItem lot={lot} />}
          </Section>
          <Section title="Encerrados" lots={lots.filter((l) => l.phase === 'ended').sort(newestFirst)} emptyText="Nenhum lote encerrado.">
            {(lot) => <AuctioneerItem lot={lot} />}
          </Section>
          <Section title="Cancelados" lots={lots.filter((l) => l.phase === 'cancelled').sort(newestFirst)} emptyText="Nenhum lote cancelado.">
            {(lot) => <AuctioneerItem lot={lot} />}
          </Section>
        </>
      )}
    </ListState>
  );
}

function ListState<T extends LotSummary>({
  query,
  empty,
  children,
}: {
  query: UseQueryResult<{ lots: T[] }>;
  empty: ReactNode;
  children: (lots: T[]) => ReactNode;
}) {
  if (query.isPending) return <ListSkeleton />;

  if (!query.data) {
    return (
      <div className="mt-10 space-y-6 border-t border-line pt-8">
        <p role="alert" className={errorClass}>
          {errorMessage(query.error)}
        </p>
        <button type="button" onClick={() => query.refetch()} className={secondaryButtonClass}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (query.data.lots.length === 0) {
    return (
      <p role="status" aria-live="polite" className="mt-10 border-t border-line pt-8 text-sm">
        {empty}
      </p>
    );
  }

  return (
    <div className="mt-10 space-y-12">
      {query.isError && (
        <p role="alert" className={errorClass}>
          Não foi possível atualizar a lista: {errorMessage(query.error)}
        </p>
      )}
      {children([...query.data.lots])}
    </div>
  );
}

function Section<T extends LotSummary>({
  title,
  lots,
  emptyText,
  children,
}: {
  title: string;
  lots: T[];
  emptyText: string;
  children: (lot: T) => ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="ui-label flex items-center gap-2 border-b border-ink pb-3">
        <Square />
        {title}
        <span className="text-muted">[{pad(lots.length)}]</span>
      </h2>
      {lots.length === 0 ? (
        <p className="ui-label py-6 text-muted">{emptyText}</p>
      ) : (
        <ol className="divide-y divide-line border-b border-line">
          {lots.map((lot, i) => (
            <li key={lot.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6">
              <Link to={`/lots/${lot.id}`} tabIndex={-1} aria-hidden="true">
                <ArtImage src={lot.imageUrl} title={lot.title} width={200} className="aspect-[4/5] w-full" />
              </Link>
              <div className="min-w-0">
                <p className="ui-label text-muted">[{pad(i + 1)}]</p>
                {children(lot)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ItemTitle({ lot }: { lot: LotSummary }) {
  return <h3 className="ui-display mt-1 line-clamp-2 text-xl leading-[1.05] [overflow-wrap:anywhere] md:text-2xl">{lot.title}</h3>;
}

function priceLabel(lot: LotSummary) {
  if (isActive(lot)) return 'Lance atual';
  return lot.phase === 'cancelled' ? 'Último lance' : 'Lance final';
}

function PriceLine({ lot }: { lot: LotSummary }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt className="text-muted">{lot.currentPriceCents !== null ? priceLabel(lot) : 'Lance inicial'}</dt>
      <dd>{formatMoney(lot.currentPriceCents ?? lot.startPriceCents)}</dd>
    </div>
  );
}

function CountdownLine({ lot }: { lot: LotSummary }) {
  if (!isActive(lot)) return null;
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt className="text-muted">Tempo</dt>
      <dd>
        <Countdown phase={lot.phase} startsAt={lot.startsAt} endsAt={lot.endsAt} />
      </dd>
    </div>
  );
}

const standingLabels: Record<BidStanding, string> = {
  leading: 'Liderando',
  outbid: 'Superado',
  won: 'Arrematado',
  lost: 'Não venceu',
  cancelled: 'Cancelado — saldo devolvido',
};

function StandingBadge({ standing }: { standing: BidStanding }) {
  if (standing === 'won') {
    return <span className="ui-label inline-flex items-center gap-2 bg-accent px-2 py-1 text-night">{standingLabels.won}</span>;
  }
  if (standing === 'cancelled') {
    return (
      <span className="ui-label inline-flex items-center gap-2 border border-gray px-2 py-1 text-muted">
        <span aria-hidden="true" className="size-2 bg-gray" />
        {standingLabels.cancelled}
      </span>
    );
  }
  return (
    <span className={`ui-label inline-flex items-center gap-2 ${standing === 'leading' ? 'border border-ink px-2 py-1' : 'text-muted'}`}>
      <span aria-hidden="true" className={`size-2 border border-current ${standing === 'leading' ? 'bg-current' : ''}`} />
      {standingLabels[standing]}
    </span>
  );
}

function BidderItem({ lot }: { lot: MyBidLot }) {
  return (
    <>
      <ItemTitle lot={lot} />
      <div className="mt-3">
        <StandingBadge standing={lot.standing} />
      </div>
      <dl className="ui-label mt-3 max-w-md space-y-1 tabular-nums">
        <PriceLine lot={lot} />
        {lot.myLastBidCents !== null && (
          <div className="flex flex-wrap justify-between gap-x-3">
            <dt className="text-muted">Seu último lance</dt>
            <dd>{formatMoney(lot.myLastBidCents)}</dd>
          </div>
        )}
        <CountdownLine lot={lot} />
      </dl>
      <p className="mt-2 flex flex-wrap gap-x-6">
        <Link to={`/lots/${lot.id}`} className={itemLinkClass}>
          Ver lote ↳
        </Link>
        {lot.standing === 'won' &&
          (lot.receiptToken ? (
            <Link to={`/comprovante/${lot.receiptToken}`} className={`${itemLinkClass} text-accent`}>
              Comprovante ↳
            </Link>
          ) : (
            <span className="ui-label inline-flex min-h-11 items-center text-muted">Comprovante em emissão</span>
          ))}
      </p>
    </>
  );
}

function AuctioneerItem({ lot }: { lot: AuctioneerLot }) {
  const { result } = lot;
  return (
    <>
      <ItemTitle lot={lot} />
      <div className="mt-3">{lot.phase === 'cancelled' ? <CancelledSeal /> : <PhaseBadge phase={lot.phase} />}</div>
      <dl className="ui-label mt-3 max-w-md space-y-1 tabular-nums">
        <PriceLine lot={lot} />
        <div className="flex flex-wrap justify-between gap-x-3">
          <dt className="text-muted">Lances</dt>
          <dd>{pad(lot.bidCount)}</dd>
        </div>
        <CountdownLine lot={lot} />
      </dl>
      {lot.phase === 'cancelled' && lot.bidCount > 0 && (
        <p className="ui-label mt-3 text-muted">Encerrado sem vencedor. O saldo reservado do líder foi devolvido.</p>
      )}
      {lot.phase === 'ended' && (
        <p className="ui-label mt-3">
          {result === null ? (
            <span className="text-muted">Apurando resultado...</span>
          ) : result.outcome === 'unsold' ? (
            'Encerrado sem lances'
          ) : (
            <>
              Vendido por <span className="font-mono tabular-nums">{formatMoney(result.amountCents)}</span> para {result.winner}
            </>
          )}
        </p>
      )}
      <p className="mt-2 flex flex-wrap gap-x-6">
        <Link to={`/lots/${lot.id}`} className={itemLinkClass}>
          Ver lote ↳
        </Link>
        {result?.outcome === 'sold' && (
          <Link to={`/comprovante/${result.receiptToken}`} className={itemLinkClass}>
            Comprovante ↳
          </Link>
        )}
        <Link to={`/auditoria/${lot.id}`} className={itemLinkClass}>
          Auditoria ↳
        </Link>
      </p>
    </>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Carregando leilões" className="mt-10 space-y-6 border-t border-line pt-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6">
          <div className="aspect-[4/5] animate-pulse border border-line" />
          <div className="space-y-3">
            <SkeletonLine className="w-10" />
            <SkeletonLine className="h-5 w-4/5" />
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
