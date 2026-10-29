import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { currentPath, withNext } from '../lib/next';
import { containerClass } from '../lib/ui';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className={`${containerClass} ui-label py-16 text-muted`}>Carregando...</p>;
  if (!user) return <Navigate to={withNext('/login', currentPath(location))} replace />;
  return <>{children}</>;
}
