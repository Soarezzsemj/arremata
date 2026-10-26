import type { Phase } from '../lib/types';

const labels: Record<Phase, string> = {
  live: 'Ao vivo',
  scheduled: 'Agendado',
  ended: 'Encerrado',
  cancelled: 'Cancelado',
};

const styles: Record<Phase, string> = {
  live: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  ended: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function PhaseBadge({ phase }: { phase: Phase }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[phase]}`}>{labels[phase]}</span>;
}