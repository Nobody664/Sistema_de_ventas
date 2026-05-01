
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { EmployeeForm } from '@/components/employees/employee-form';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import type { Employee } from '@/types/api';

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

async function getEmployee(id: string, accessToken: string | undefined): Promise<Employee | null> {
  try {
    return await serverApiFetch<Employee>(`/employees/${id}`, accessToken);
  } catch {
    return null;
  }
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  if (!session?.user) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const employee = await getEmployee(id, accessToken);

  if (!employee) {
    notFound();
  }

  return <EmployeeForm employee={employee} />;
}
