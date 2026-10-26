import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../lib/types';
import { containerClass } from '../lib/ui';

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className={`${containerClass} ui-label py-16 text-muted`}>Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <p className={`${containerClass} ui-label py-16`}>Você não tem permissão para ver esta página.</p>;
  return <>{children}</>;
}