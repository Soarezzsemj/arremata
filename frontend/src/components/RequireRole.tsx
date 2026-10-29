import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../lib/types';
import { currentPath, withNext } from '../lib/next';
import { containerClass } from '../lib/ui';

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className={`${containerClass} ui-label py-16 text-muted`}>Carregando...</p>;
  if (!user) return <Navigate to={withNext('/login', currentPath(location))} replace />;
  if (user.role !== role) return <p className={`${containerClass} ui-label py-16`}>Você não tem permissão para ver esta página.</p>;
  return <>{children}</>;
}