import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { containerClass } from '../lib/ui';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className={`${containerClass} ui-label py-16 text-muted`}>Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
