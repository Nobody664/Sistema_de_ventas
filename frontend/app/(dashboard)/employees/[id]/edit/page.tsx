import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { EmployeeForm } from '@/components/employees/employee-form';
import { serverApiFetch } from '@/lib/server-api';
import type { Employee } from '@/types/api';

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

async function getEmployee(id: string): Promise<Employee | null> {
  const session = await auth();
  try {
    return await serverApiFetch<Employee>(`/employees/${id}`, session?.accessToken);
  } catch {
    return null;
  }
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const employee = await getEmployee(id);

  if (!employee) {
    notFound();
  }

  return <EmployeeForm employee={employee} />;
}
