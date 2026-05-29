'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/types/permissions';

type PageGuardProps = {
  requiredPermissions?: Permission[];
  requiredRoles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function PageGuard({ requiredPermissions, requiredRoles, fallback, children }: PageGuardProps) {
  const router = useRouter();
  const { hasAllPermissions, roles, isSuperAdmin } = usePermissions();

  const hasAccess =
    isSuperAdmin ||
    (requiredRoles && requiredRoles.length > 0
      ? requiredRoles.some((r) => roles.includes(r))
      : true) &&
    (requiredPermissions && requiredPermissions.length > 0
      ? hasAllPermissions(...requiredPermissions)
      : true);

  useEffect(() => {
    if (!hasAccess && !fallback) {
      router.replace('/forbidden');
    }
  }, [hasAccess, fallback, router]);

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
