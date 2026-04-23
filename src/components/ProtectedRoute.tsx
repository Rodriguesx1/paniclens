import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ReactNode } from 'react';

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: 'super_admin' | 'org_admin' | 'premium_technician' | 'technician';
}) {
  const { user, loading, memberships, currentOrgId } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (requiredRole) {
    const hasRole = requiredRole === 'super_admin'
      ? memberships.some(m => m.role === requiredRole)
      : memberships.some(m => m.role === requiredRole && (!currentOrgId || m.org_id === currentOrgId));
    if (!hasRole) return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}
