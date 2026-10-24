// Endereço base da API. Em produção (Vercel) aponta para o Render;
// localmente e no Docker fica "/api" e o proxy (Vite ou nginx) repassa.
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Formato de erro padrão que a API devolve
export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const error: ApiError = body?.error ?? { code: 'INTERNAL', message: 'Erro ao falar com a API' };
    throw error;
  }
  return body as T;
}
