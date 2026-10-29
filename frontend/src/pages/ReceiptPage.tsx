import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ArtImage } from '../components/ArtImage';
import { Frame } from '../components/Frame';
import { SkeletonLine } from '../components/Skeleton';
import { Square } from '../components/Square';
import { apiGet, type ApiError } from '../lib/api';
import { errorMessage, formatDateTime, formatMoney } from '../lib/format';
import type { Receipt } from '../lib/types';
import { containerClass, errorClass, secondaryButtonClass } from '../lib/ui';

const backLinkClass = 'ui-label inline-flex min-h-11 items-center gap-2 hover:underline hover:decoration-accent hover:underline-offset-4';

function isNotFound(err: unknown) {
  return !!err && typeof err === 'object' && 'code' in err && (err as ApiError).code === 'RECEIPT_NOT_FOUND';
}

export function ReceiptPage() {
  const { token } = useParams();

  const receipt = useQuery({
    queryKey: ['receipt', token],
    queryFn: () => apiGet<Receipt>(`/receipts/${encodeURIComponent(token ?? '')}`),
    
    staleTime: Infinity,
    retry: (count, err) => !isNotFound(err) && count < 2,
  });

  if (receipt.isPending) {
    return (
      <div role="status" aria-label="Carregando comprovante" className={`${containerClass} grid gap-10 py-10 lg:grid-cols-[1fr_1.15fr]`}>
        <div className="aspect-[4/5] animate-pulse border border-line" />
        <div className="space-y-6 border-t border-line pt-6">
          <SkeletonLine className="w-28" />
          <SkeletonLine className="h-12 w-4/5" />
          <SkeletonLine className="h-10 w-1/2" />
          <SkeletonLine className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (receipt.isError) {
    return (
      <div className={`${containerClass} py-16`}>
        {isNotFound(receipt.error) ? (
          <p role="alert" className="ui-display text-4xl leading-[0.9] md:text-5xl">
            Comprovante não encontrado
          </p>
        ) : (
          <p role="alert" className={errorClass}>
            {errorMessage(receipt.error)}
          </p>
        )}
        <Link to="/" className={`${backLinkClass} mt-6`}>
          ↰ Voltar aos lotes
        </Link>
      </div>
    );
  }

  const data = receipt.data;
  const attributes = Object.entries(data.attributes);

  return (
    <section className={`${containerClass} py-6 md:py-10`}>
      <Link to={`/lots/${data.lotId}`} className={backLinkClass}>
        ↰ Ver lote
      </Link>

      <div className="mt-4 grid items-start gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        <Frame className="p-4 md:p-6">
          <ArtImage
            src={data.imageUrl}
            title={data.title}
            width={843}
            loading="eager"
            fit="contain"
            className="mx-auto max-h-[70svh] w-full"
            fallbackClassName="aspect-[4/5]"
          />
        </Frame>

        <div className="divide-y divide-line border-y border-line">
          <p className="ui-label flex items-center gap-2 py-3 text-muted">
            <Square className="text-accent" />
            Comprovante de arremate
          </p>

          <h1 className="ui-display py-6 text-[clamp(2rem,4.5vw,3.75rem)] leading-[0.92] [overflow-wrap:anywhere]">{data.title}</h1>

          <div className="py-6 tabular-nums">
            <p className="ui-label text-muted">Arrematado por {data.winner}</p>
            <p className="mt-2 font-mono text-[clamp(2.25rem,5vw,4rem)] leading-none tracking-tight">{formatMoney(data.amountCents)}</p>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-line tabular-nums">
            <div className="py-4 pr-4">
              <dt className="ui-label text-muted">Lances</dt>
              <dd className="mt-1 font-mono text-lg">{String(data.bidCount).padStart(2, '0')}</dd>
            </div>
            <div className="py-4 pl-4">
              <dt className="ui-label text-muted">Emitido em</dt>
              <dd className="mt-1 font-mono text-lg">
                <time dateTime={data.issuedAt}>{formatDateTime(data.issuedAt)}</time>
              </dd>
            </div>
          </dl>

          {attributes.length > 0 && (
            <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-2 py-6 text-sm">
              {attributes.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="ui-label pt-0.5 text-muted">{key}</dt>
                  <dd className="font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="space-y-4 py-6">
            <h2 className="ui-label text-muted">Hash final</h2>
            <Frame className="px-4 py-3">
              <p className="font-mono text-sm leading-relaxed [overflow-wrap:anywhere]">{data.finalHash}</p>
            </Frame>
            <p className="text-sm text-muted">
              O hash final identifica a cadeia de lances deste lote. Qualquer alteração nos lances muda esse valor.
            </p>
            {}
            <div className="flex flex-wrap gap-2">
              <CopyButton label="Copiar hash" text={() => data.finalHash} />
              <CopyButton label="Copiar link" text={() => window.location.href} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyButton({ label, text }: { label: string; text: () => string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2_000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" onClick={copy} className={secondaryButtonClass}>
        {label}
      </button>
      <span aria-live="polite" className="ui-label min-w-[7ch] text-muted">
        {state === 'copied' ? 'Copiado' : state === 'failed' ? 'Não copiou' : ''}
      </span>
    </span>
  );
}
