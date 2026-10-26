import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../lib/types';

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="py-8">Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <p className="py-8">Você não tem permissão para ver esta página.</p>;
  return <>{children}</>;
}