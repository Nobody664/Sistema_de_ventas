import { Suspense } from 'react';
import { SignUpPageClient } from './sign-up-client';

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="size-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>}>
      <SignUpPageClient />
    </Suspense>
  );
}