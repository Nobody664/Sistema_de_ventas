'use client';

import { useSession } from 'next-auth/react';
import { ROLE_PERMISSIONS, type Permission } from '@/types/permissions';

export function usePermissions() {
  const { data: session } = useSession();
  const roles = session?.user?.roles ?? [];

  const hasPermission = (permission: Permission): boolean => {
    return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
  };

  const hasAnyPermission = (...permissions: Permission[]): boolean => {
    return permissions.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (...permissions: Permission[]): boolean => {
    return permissions.every((p) => hasPermission(p));
  };

  const isAdmin = roles.includes('COMPANY_ADMIN') || roles.includes('SUPER_ADMIN');
  const isManager = roles.includes('MANAGER') || isAdmin;
  const isCashier = roles.includes('CASHIER') || isManager;
  const isSuperAdmin = roles.includes('SUPER_ADMIN');

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    roles,
    isAdmin,
    isManager,
    isCashier,
    isSuperAdmin,
  };
}
