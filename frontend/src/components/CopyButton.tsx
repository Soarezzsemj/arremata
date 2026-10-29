import { useEffect, useState } from 'react';
import { secondaryButtonClass } from '../lib/ui';

export function CopyButton({ label, text, className = '' }: { label: string; text: () => string; className?: string }) {
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
      <button type="button" onClick={copy} className={`${secondaryButtonClass} ${className}`}>
        {label}
      </button>
      <span aria-live="polite" className="ui-label min-w-[7ch] text-muted">
        {state === 'copied' ? 'Copiado' : state === 'failed' ? 'Não copiou' : ''}
      </span>
    </span>
  );
}
