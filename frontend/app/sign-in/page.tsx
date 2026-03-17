import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignInPageClient } from './sign-in-client';

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return <SignInPageClient />;
}
