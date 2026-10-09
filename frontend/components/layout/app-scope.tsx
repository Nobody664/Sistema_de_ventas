'use client';

import { useEffect } from 'react';

export function AppScope() {
  useEffect(() => {
    document.body.dataset.app = '';
    return () => {
      delete document.body.dataset.app;
    };
  }, []);

  return null;
}
