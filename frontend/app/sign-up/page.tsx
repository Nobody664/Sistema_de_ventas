import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignUpPageClient } from './sign-up-client';

export default async function SignUpPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return <SignUpPageClient />;
}
