import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';

type Health = { status: string; serverTime: string };

// Página provisória: só confere se a API está respondendo
export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<Health>('/health'),
  });

  let statusText = 'Verificando a API...';
  let statusColor = 'text-slate-500';
  if (health.isSuccess) {
    statusText = 'API no ar';
    statusColor = 'text-green-600 dark:text-green-400';
  } else if (health.isError) {
    statusText = 'API fora do ar';
    statusColor = 'text-red-600 dark:text-red-400';
  }

  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold">Arremata</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Casa de leilões online</p>
      <p className={`mt-8 font-medium ${statusColor}`}>{statusText}</p>
    </section>
  );
}
