export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
  return `${minutes}min ${seconds}s`;
}

// Transforma o erro da API (ou qualquer outro) em um texto para mostrar na tela
export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    let text = err.message;
    const details = 'details' in err ? (err.details as { issues?: { path: string; message: string }[] }) : undefined;
    if (details?.issues?.length) {
      text += ' ' + details.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    }
    return text;
  }
  return 'Algo deu errado.';
}