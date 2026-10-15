'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export function AuthHydrator() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return null;
}
