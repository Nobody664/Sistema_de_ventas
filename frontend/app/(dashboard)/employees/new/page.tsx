import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { EmployeeForm } from '@/components/employees/employee-form';

export default async function NewEmployeePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <EmployeeForm />;
}
