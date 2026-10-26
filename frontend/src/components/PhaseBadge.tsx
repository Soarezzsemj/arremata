import type { Phase } from '../lib/types';

const labels: Record<Phase, string> = {
  live: 'Ao vivo',
  scheduled: 'Agendado',
  ended: 'Encerrado',
  cancelled: 'Cancelado',
};


const styles: Record<Phase, string> = {
  live: '',
  scheduled: '',
  ended: 'opacity-75',
  cancelled: 'line-through opacity-75',
};

export function PhaseBadge({ phase }: { phase: Phase }) {
  return (
    <span className={`ui-label inline-flex items-center gap-2 whitespace-nowrap ${styles[phase]}`}>
      {phase === 'live' ? (
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-accent" />
        </span>
      ) : (
        <span aria-hidden="true" className={`size-2 border border-current ${phase === 'scheduled' ? '' : 'bg-current'}`} />
      )}
      {labels[phase]}
    </span>
  );
}
