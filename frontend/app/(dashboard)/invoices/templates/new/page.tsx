import { auth } from '@/auth';
import { redirect } from 'next/navigation';
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

interface NewTemplatePageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewTemplatePage({ searchParams }: NewTemplatePageProps) {
  const { type } = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const roles = session.user.roles || [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  
  if (!isSuperAdmin) {
    redirect('/dashboard');
  }

  const presetConfigs: Record<string, Partial<InvoiceTemplate>> = {
    BOLETA: {
      name: 'Boleta Estándar',
      type: 'BOLETA',
      paperSize: 'A4',
      taxPercentage: 18,
      showTax: true,
      showSaleTime: false,
    },
    TICKET: {
      name: 'Ticket Térmico',
      type: 'TICKET',
      paperSize: 'thermal',
      taxPercentage: 0,
      showTax: false,
      showSaleTime: true,
    },
    FACTURA: {
      name: 'Factura',
      type: 'FACTURA',
      paperSize: 'A4',
      taxPercentage: 18,
      showTax: true,
      showSaleTime: false,
    },
  };

  const preset = type && presetConfigs[type] ? presetConfigs[type] : {};

  return <TemplateEditor template={null} preset={preset} />;
}
