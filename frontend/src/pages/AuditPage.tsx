import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { CopyButton } from '../components/CopyButton';
import { Frame } from '../components/Frame';
import { PhaseBadge } from '../components/PhaseBadge';
import { SkeletonLine } from '../components/Skeleton';
import { Square } from '../components/Square';
import { apiGet, type ApiError } from '../lib/api';
import { errorMessage, formatDateTime, formatMoney } from '../lib/format';
import type { AuditBid, AuditIssueCode, LotAudit } from '../lib/types';
import { containerClass, errorClass, secondaryButtonClass } from '../lib/ui';

const backLinkClass = 'ui-label inline-flex min-h-11 items-center gap-2 hover:underline hover:decoration-accent hover:underline-offset-4';

const issueExplanations: Record<AuditIssueCode, string> = {
  SEQ_GAP: 'Lance faltando na sequência.',
  BROKEN_LINK: 'Um lance não aponta para o anterior.',
  HASH_MISMATCH: 'O conteúdo de um lance foi alterado.',
  COUNT_MISMATCH: 'A quantidade de lances não confere.',
  HEAD_MISMATCH: 'O último hash não confere com o do lote.',
  STATE_MISMATCH: 'Preço ou líder do lote não confere com o último lance.',
  RECEIPT_MISMATCH: 'O hash do comprovante não confere.',
};

function isKnownCode(code: string): code is AuditIssueCode {
  return code in issueExplanations;
}

function isNotFound(err: unknown) {
  return !!err && typeof err === 'object' && 'code' in err && (err as ApiError).code === 'LOT_NOT_FOUND';
}

function shortHash(hash: string) {
  return hash.length > 20 ? `${hash.slice(0, 8)}…${hash.slice(-8)}` : hash;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function checkLinks(audit: LotAudit) {
  const links = new Map<number, boolean>();
  let prev = audit.genesisHash;
  for (const bid of audit.bids) {
    links.set(bid.seq, bid.prevHash === prev);
    prev = bid.hash;
  }
  const lastHash = audit.bids.length > 0 ? audit.bids[audit.bids.length - 1].hash : null;
  const broken = [...links.values()].filter((ok) => !ok).length;
  return { links, broken, headOk: lastHash === audit.headHash };
}

export function AuditPage() {
  const { lotId } = useParams();

  const audit = useQuery({
    queryKey: ['audit', lotId],
    queryFn: () => apiGet<LotAudit>(`/audit/${encodeURIComponent(lotId ?? '')}`),
    // Busca ao abrir; depois só pelo botão "Verificar novamente", para o resultado não mudar enquanto a pessoa lê
    refetchOnWindowFocus: false,
    retry: (count, err) => !isNotFound(err) && count < 2,
  });

  if (audit.isPending) {
    return (
      <div role="status" aria-label="Carregando auditoria" className={`${containerClass} space-y-6 py-12 md:py-20`}>
        <SkeletonLine className="w-36" />
        <SkeletonLine className="h-12 w-4/5" />
        <SkeletonLine className="h-28 w-full" />
        <SkeletonLine className="h-16 w-full" />
        <SkeletonLine className="h-16 w-full" />
      </div>
    );
  }

  if (!audit.data) {
    return (
      <div className={`${containerClass} space-y-6 py-16`}>
        {isNotFound(audit.error) ? (
          <p role="alert" className="ui-display text-4xl leading-[0.9] md:text-5xl">
            Lote não encontrado
          </p>
        ) : (
          <>
            <p role="alert" className={errorClass}>
              {errorMessage(audit.error)}
            </p>
            <button type="button" onClick={() => audit.refetch()} className={secondaryButtonClass}>
              Tentar de novo
            </button>
          </>
        )}
        <Link to="/" className={backLinkClass}>
          ↰ Voltar aos lotes
        </Link>
      </div>
    );
  }

  const data = audit.data;
  const { links, broken, headOk } = checkLinks(data);
  const bids = [...data.bids].sort((a, b) => b.seq - a.seq);

  return (
    <section className={`${containerClass} py-6 md:py-10`}>
      <Link to={`/lots/${data.lotId}`} className={backLinkClass}>
        ↰ Ver lote
      </Link>

      <div className="mt-4 divide-y divide-line border-y border-line">
        <div className="flex flex-wrap items-center justify-between gap-4 py-3">
          <p className="ui-label flex items-center gap-2 text-muted">
            <Square className="text-accent" />
            Auditoria do lote
          </p>
          <PhaseBadge phase={data.phase} />
        </div>

        <h1 className="ui-display py-6 text-[clamp(2rem,4.5vw,3.75rem)] leading-[0.92] [overflow-wrap:anywhere]">{data.title}</h1>

        <dl className="grid grid-cols-2 divide-x divide-line tabular-nums">
          <div className="py-4 pr-4">
            <dt className="ui-label text-muted">Lances</dt>
            <dd className="mt-1 font-mono text-lg">{pad(data.bidCount)}</dd>
          </div>
          <div className="py-4 pl-4">
            <dt className="ui-label text-muted">Verificado em</dt>
            <dd className="mt-1 font-mono text-lg">
              <time dateTime={new Date(audit.dataUpdatedAt).toISOString()}>{formatDateTime(new Date(audit.dataUpdatedAt).toISOString())}</time>
            </dd>
          </div>
        </dl>

        {}
        <div className="py-6">
          <Frame className={`px-5 py-5 ${data.verification.ok ? '' : 'text-accent'}`}>
            <h2 className="ui-label flex items-center gap-2 text-muted">
              <Square />
              Verificação
            </h2>
            <div role="status" aria-live="polite" className="mt-3 text-ink">
              {data.verification.ok ? (
                <>
                  <p className="ui-display text-3xl leading-[0.95] md:text-4xl">Cadeia íntegra</p>
                  <p className="mt-2 text-sm">Todos os lances conferem com os hashes registrados.</p>
                </>
              ) : (
                <>
                  <p className="ui-display text-3xl leading-[0.95] text-accent md:text-4xl">Adulteração detectada</p>
                  <ul className="mt-4 divide-y divide-line border-y border-line">
                    {data.verification.issues.map((issue, i) => (
                      <li key={`${issue.code}-${issue.seq ?? 'x'}-${i}`} className="py-3 text-sm">
                        <p className="ui-label flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-accent">{issue.code}</span>
                          {issue.seq !== null && <span className="text-muted">Lance [{pad(issue.seq)}]</span>}
                        </p>
                        {}
                        <p className="mt-1">{isKnownCode(issue.code) ? issueExplanations[issue.code] : issue.message}</p>
                        {isKnownCode(issue.code) && issue.message && <p className="mt-1 text-muted">{issue.message}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Frame>
        </div>

        {}
        <div className="space-y-3 py-6">
          <h2 className="ui-label flex items-center gap-2">
            <Square />
            Conferência no navegador
          </h2>
          <p className="ui-label tabular-nums">
            {data.bids.length - broken} de {data.bids.length} elos ok
            {broken > 0 && <span className="text-accent"> · {broken} quebrado{broken > 1 ? 's' : ''}</span>}
          </p>
          <p className={`ui-label ${headOk ? '' : 'text-accent'}`}>
            {headOk ? 'Último hash confere com o do lote' : 'Último hash não confere com o do lote'}
          </p>
          <p className="max-w-prose text-sm text-muted">
            O encadeamento dos hashes pode ser conferido por qualquer pessoa, aqui no navegador. O recálculo completo de cada hash
            usa um segredo do servidor e é feito por ele; por isso esta auditoria detecta adulteração, mas não a impede.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => audit.refetch()}
              disabled={audit.isFetching}
              aria-busy={audit.isFetching || undefined}
              className={secondaryButtonClass}
            >
              {audit.isFetching ? 'Verificando...' : 'Verificar novamente'}
            </button>
            <span aria-live="polite" className="ui-label text-muted">
              {audit.isError ? `Não foi possível verificar de novo: ${errorMessage(audit.error)}` : ''}
            </span>
          </div>
        </div>

        <div className="space-y-5 py-6">
          <h2 className="ui-label text-muted">Hashes</h2>
          <HashRow label="Genesis" hash={data.genesisHash} />
          <HashRow label="Último hash (head)" hash={data.headHash} empty="Nenhum lance ainda" />
          <HashRow label="Hash final" hash={data.finalHash} empty="Ainda não liquidado" />
        </div>

        <BidChain bids={bids} links={links} total={data.bids.length} />
      </div>
    </section>
  );
}

function HashRow({ label, hash, empty = '' }: { label: string; hash: string | null; empty?: string }) {
  return (
    <div className="space-y-2">
      <h3 className="ui-label">{label}</h3>
      {hash ? (
        <>
          <Frame className="px-4 py-3">
            <p className="font-mono text-sm leading-relaxed [overflow-wrap:anywhere]">{hash}</p>
          </Frame>
          <CopyButton label="Copiar" text={() => hash} />
        </>
      ) : (
        <p className="ui-label text-muted">{empty}</p>
      )}
    </div>
  );
}

function BidChain({ bids, links, total }: { bids: AuditBid[]; links: Map<number, boolean>; total: number }) {
  return (
    <div className="py-6">
      <h2 className="ui-label flex items-center gap-2">
        Lances
        <span className="text-muted">[{pad(total)}]</span>
      </h2>
      {bids.length === 0 ? (
        <p className="ui-label mt-4 text-muted">Nenhum lance ainda</p>
      ) : (
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {bids.map((bid) => {
            const ok = links.get(bid.seq) ?? false;
            return (
              <li key={bid.seq} className="py-4 tabular-nums">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-4">
                  <span className="ui-label text-muted">[{pad(bid.seq)}]</span>
                  <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
                    {bid.bidder}
                    <span className="ui-label block text-muted">
                      <time dateTime={bid.at}>{formatDateTime(bid.at)}</time>
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-right font-mono">{formatMoney(bid.amountCents)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 pl-0 sm:pl-12">
                  <span className={`ui-label inline-flex items-center gap-2 ${ok ? '' : 'text-accent'}`}>
                    <span aria-hidden="true" className={`size-2 border border-current ${ok ? 'bg-current' : ''}`} />
                    {ok ? 'Elo ok' : 'Elo quebrado'}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    <span className="sr-only">Anterior: </span>
                    <span aria-hidden="true">← </span>
                    {shortHash(bid.prevHash)}
                  </span>
                  <span className="font-mono text-xs">
                    <span className="sr-only">Hash: </span>
                    {shortHash(bid.hash)}
                  </span>
                </div>
                <details className="mt-2 sm:pl-12">
                  <summary className="ui-label inline-flex min-h-11 cursor-pointer items-center text-muted hover:text-ink">
                    Ver hashes completos
                  </summary>
                  <dl className="mt-2 space-y-2 font-mono text-xs leading-relaxed">
                    <div>
                      <dt className="ui-label text-muted">Anterior</dt>
                      <dd className="[overflow-wrap:anywhere]">{bid.prevHash}</dd>
                    </div>
                    <div>
                      <dt className="ui-label text-muted">Hash</dt>
                      <dd className="[overflow-wrap:anywhere]">{bid.hash}</dd>
                    </div>
                  </dl>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
