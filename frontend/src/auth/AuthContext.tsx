import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, getToken, setToken } from '../lib/api';
import type { Role, User } from '../lib/types';

type AuthResponse = { token: string; user: User };
type RegisterInput = { name: string; email: string; password: string; role: Role };

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => getToken() !== null);

  // Ao abrir o site, se existe token salvo, descobre quem é o usuário
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    apiGet<{ user: User } | User>('/auth/me')
      .then((body) => {
        if (!cancelled) setUser('user' in body ? body.user : body);
      })
      .catch(() => setToken(null))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    const body = await apiPost<AuthResponse>('/auth/login', { email, password });
    setToken(body.token);
    setUser(body.user);
    queryClient.clear();
    return body.user;
  }

  async function register(input: RegisterInput) {
    const body = await apiPost<AuthResponse>('/auth/register', input);
    setToken(body.token);
    setUser(body.user);
    queryClient.clear();
    return body.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    queryClient.clear();
  }

  return <AuthContext value={{ user, loading, login, register, logout }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}