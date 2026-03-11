'use client';

import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/types/permissions';

type PermissionGuardProps = {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const { hasPermission } = usePermissions();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
