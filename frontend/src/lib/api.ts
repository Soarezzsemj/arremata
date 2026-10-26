export const API_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'token';

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sem localStorage o login só não sobrevive quando recarregar a página
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const error: ApiError = { code: 'NETWORK', message: 'Não foi possível falar com a API.' };
    throw error;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error: ApiError = data?.error ?? { code: 'INTERNAL', message: 'Erro ao falar com a API' };
    throw error;
  }
  return data as T;
}

export function apiGet<T>(path: string) {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body: unknown = {}) {
  return request<T>('POST', path, body);
}