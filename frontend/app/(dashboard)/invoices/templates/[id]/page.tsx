import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '@/lib/server-api';
import { TemplateEditor } from '../template-editor';

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

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const roles = session.user.roles || [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  
  if (!isSuperAdmin) {
    redirect('/dashboard');
  }

  let template: InvoiceTemplate | null = null;
  
  if (id !== 'new') {
    const templates = await serverApiFetch<InvoiceTemplate[]>(
      '/invoices/templates',
      session.accessToken
    );
    template = templates?.find(t => t.id === id) || null;
  }

  return <TemplateEditor template={template} />;
}
