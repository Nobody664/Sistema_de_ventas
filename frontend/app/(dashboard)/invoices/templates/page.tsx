
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { getServerSession } from '@/lib/session';
import { InvoicesTemplatesClient } from './invoices-templates-client';

interface InvoiceTemplate {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isGlobal: boolean;
  isDefault: boolean;
  paperSize: string;
  fontFamily: string;
  fontSize: number;
  logoUrl: string | null;
  companyRuc: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  showLogo: boolean;
  showCompany: boolean;
  showCustomer: boolean;
  showEmployee: boolean;
  showItems: boolean;
  showSubtotal: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showSaleNumber: boolean;
  showSaleDate: boolean;
  showSaleTime: boolean;
  showPaymentMethod: boolean;
  footerText: string | null;
  taxPercentage: number;
}

export default async function InvoicesTemplatesPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const roles: string[] = session?.user?.roles || [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPPORT_ADMIN');
  
  if (!isSuperAdmin) {
    redirect('/dashboard');
  }

  const templates = await serverApiFetch<InvoiceTemplate[]>('/invoices/templates', session?.accessToken);

  return <InvoicesTemplatesClient templates={templates ?? []} />;
}
