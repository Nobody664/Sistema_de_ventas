
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { EmployeeForm } from '@/components/employees/employee-form';

export default async function NewEmployeePage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return <EmployeeForm />;
}
