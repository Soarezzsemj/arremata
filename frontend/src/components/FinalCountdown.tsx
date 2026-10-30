import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FINAL_COUNTDOWN_MS, finalStage, type FinalStage } from '../lib/auction';
import { formatRemaining } from '../lib/format';
import { useNow } from '../lib/useNow';

const EXTENDED_NOTICE_MS = 2_000;

const calls: Partial<Record<FinalStage, string>> = {
  one: 'Dou-lhe uma…',
  two: 'Dou-lhe duas…',
  three: 'Dou-lhe três…',
};

const barColor: Record<FinalStage, string> = {
  normal: 'bg-ink',
  final: 'bg-ink',
  one: 'bg-ink',
  two: 'bg-amber-500',
  three: 'bg-accent',
  closing: 'bg-accent',
};

const callColor: Partial<Record<FinalStage, string>> = {
  one: 'text-ink',
  two: 'text-amber-700 dark:text-amber-400',
  three: 'text-accent',
};

export function SettlingStatus({ children }: { children: ReactNode }) {
  return (
    <p className="ui-label inline-flex items-center gap-2">
      <span aria-hidden="true" className="size-2 animate-pulse bg-current" />
      {children}
    </p>
  );
}

export function useExtendedNotice(lotId: string | undefined, endsAt: string | undefined) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previous = useRef<{ lotId: string | undefined; endsAt: string | undefined }>({ lotId, endsAt });

  const show = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), EXTENDED_NOTICE_MS);
  }, []);

  useEffect(() => {
    const prev = previous.current;
    previous.current = { lotId, endsAt };
    if (prev.lotId !== lotId) {
      clearTimeout(timer.current);
      setVisible(false);
      return;
    }
    if (prev.endsAt && endsAt && new Date(endsAt).getTime() > new Date(prev.endsAt).getTime()) show();
  }, [lotId, endsAt, show]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { visible, show };
}

export function FinalCountdown({ endsAt, extended }: { endsAt: string; extended: boolean }) {
  const end = new Date(endsAt).getTime();
  const now = useNow(end);
  const left = Math.max(0, end - now);
  const stage = finalStage(end - now);
  const inFinal = stage !== 'normal';
  const ratio = stage === 'normal' ? 1 : Math.min(1, left / FINAL_COUNTDOWN_MS);
  const call = calls[stage];

  let slot: ReactNode;
  if (extended) {
    slot = <p className="ui-label border border-accent px-3 py-1.5 text-ink">Tempo estendido: +2 min</p>;
  } else if (stage === 'closing') {
    slot = <SettlingStatus>Encerrando… apurando resultado</SettlingStatus>;
  } else if (call) {
    slot = (
      <p key={stage} className={`call-in ui-display whitespace-nowrap text-3xl leading-none md:text-4xl ${callColor[stage]}`}>
        {call}
      </p>
    );
  } else if (stage === 'final') {
    slot = <p className="ui-label text-ink">Contagem final</p>;
  } else {
    slot = <p className="ui-label text-muted">Lances nos últimos 2 min prorrogam o fim em +2 min.</p>;
  }

  return (
    <div className="py-4">
      <p className="font-mono text-lg uppercase tabular-nums">Termina em {formatRemaining(left)}</p>

      {}
      <div aria-live="polite" aria-atomic="true" className="mt-3 flex h-12 items-center overflow-hidden md:h-14">
        {slot}
      </div>

      <div aria-hidden="true" className="mt-2 h-1.5 w-full overflow-hidden bg-line">
        <div
          className={`h-full w-full origin-left motion-reduce:transition-colors ${barColor[stage]} ${
            inFinal ? 'transition-[transform,background-color] duration-100 ease-linear' : 'transition-[transform,background-color] duration-700 ease-out'
          }`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}
