'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, Save, Printer, FileText, Ticket, Receipt, 
  Building2, User, CreditCard, Package, Eye, Palette
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

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

interface TemplateEditorProps {
  template: InvoiceTemplate | null;
  preset?: Partial<InvoiceTemplate>;
}

const defaultTemplate: Omit<InvoiceTemplate, 'id'> = {
  name: '',
  description: null,
  type: 'BOLETA',
  isGlobal: true,
  isDefault: false,
  paperSize: 'A4',
  fontFamily: 'Arial',
  fontSize: 12,
  logoUrl: null,
  companyRuc: null,
  companyAddress: null,
  companyPhone: null,
  showLogo: true,
  showCompany: true,
  showCustomer: true,
  showEmployee: false,
  showItems: true,
  showSubtotal: true,
  showTax: true,
  showDiscount: true,
  showSaleNumber: true,
  showSaleDate: true,
  showSaleTime: false,
  showPaymentMethod: true,
  footerText: 'Gracias por su preferencia',
  taxPercentage: 18,
};

const sampleItems = [
  { name: 'Producto de ejemplo 1', quantity: 2, unitPrice: 25.00, total: 50.00 },
  { name: 'Producto de ejemplo 2', quantity: 1, unitPrice: 35.50, total: 35.50 },
  { name: 'Producto de ejemplo 3', quantity: 3, unitPrice: 15.00, total: 45.00 },
];

export function TemplateEditor({ template, preset }: TemplateEditorProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);
  
  const [formData, setFormData] = useState<Omit<InvoiceTemplate, 'id'>>(defaultTemplate);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        type: template.type,
        isGlobal: template.isGlobal,
        isDefault: template.isDefault,
        paperSize: template.paperSize,
        fontFamily: template.fontFamily,
        fontSize: template.fontSize,
        logoUrl: template.logoUrl,
        companyRuc: template.companyRuc,
        companyAddress: template.companyAddress,
        companyPhone: template.companyPhone,
        showLogo: template.showLogo,
        showCompany: template.showCompany,
        showCustomer: template.showCustomer,
        showEmployee: template.showEmployee,
        showItems: template.showItems,
        showSubtotal: template.showSubtotal,
        showTax: template.showTax,
        showDiscount: template.showDiscount,
        showSaleNumber: template.showSaleNumber,
        showSaleDate: template.showSaleDate,
        showSaleTime: template.showSaleTime,
        showPaymentMethod: template.showPaymentMethod,
        footerText: template.footerText,
        taxPercentage: template.taxPercentage,
      });
    } else if (preset) {
      setFormData(prev => ({ ...prev, ...preset }));
    }
  }, [template, preset]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<InvoiceTemplate>) =>
      apiFetch<InvoiceTemplate>('/invoices/templates', {
        method: 'POST',
        token: session?.accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      addToast('Plantilla creada correctamente', 'success');
      router.push('/invoices/templates');
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InvoiceTemplate>) =>
      apiFetch<InvoiceTemplate>(`/invoices/templates/${template?.id}`, {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      addToast('Plantilla actualizada correctamente', 'success');
      router.push('/invoices/templates');
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      addToast('El nombre es requerido', 'error');
      return;
    }

    if (template) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getTypeConfig = () => {
    const configs: Record<string, { icon: typeof FileText; label: string; color: string }> = {
      BOLETA: { icon: FileText, label: 'Boleta', color: 'from-blue-500 to-indigo-600' },
      TICKET: { icon: Ticket, label: 'Ticket', color: 'from-orange-500 to-amber-600' },
      FACTURA: { icon: Receipt, label: 'Factura', color: 'from-emerald-500 to-teal-600' },
    };
    return configs[formData.type] || configs.BOLETA;
  };

  const typeConfig = getTypeConfig();
  const TypeIcon = typeConfig.icon;

  const renderPreview = () => {
    const isThermal = formData.paperSize === 'thermal';
    
    if (isThermal) {
      return <ThermalPreview formData={formData} />;
    }
    
    return <StandardPreview formData={formData} />;
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/invoices/templates')}
            className="text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div className="h-6 w-px bg-slate-300" />
          <h1 className="text-2xl font-bold text-slate-900">
            {template ? `Editar: ${template.name}` : 'Nueva Plantilla'}
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-2xl border-0 shadow-xl">
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('config')}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'config'
                      ? 'bg-white text-slate-900 border-b-2 border-blue-500'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Palette className="mr-2 inline h-4 w-4" />
                  Configuración
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-white text-slate-900 border-b-2 border-blue-500'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Eye className="mr-2 inline h-4 w-4" />
                  Vista Previa
                </button>
              </div>

              {activeTab === 'config' && (
                <form onSubmit={handleSubmit} className="space-y-6 p-6">
                  <div className="grid grid-cols-3 gap-3">
                    {(['BOLETA', 'TICKET', 'FACTURA'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateField('type', type)}
                        className={`rounded-xl border-2 p-4 text-center transition-all ${
                          formData.type === type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {type === 'BOLETA' && <FileText className="mx-auto h-6 w-6 text-blue-500" />}
                        {type === 'TICKET' && <Ticket className="mx-auto h-6 w-6 text-orange-500" />}
                        {type === 'FACTURA' && <Receipt className="mx-auto h-6 w-6 text-emerald-500" />}
                        <span className="mt-2 block text-sm font-medium">{type}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">Información General</h3>
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="name">Nombre de la plantilla *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => updateField('name', e.target.value)}
                          placeholder="Mi Boleta Personalizada"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Descripción</Label>
                        <Input
                          id="description"
                          value={formData.description || ''}
                          onChange={(e) => updateField('description', e.target.value)}
                          placeholder="Descripción opcional"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">Formato</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="paperSize">Tamaño de papel</Label>
                        <select
                          id="paperSize"
                          value={formData.paperSize}
                          onChange={(e) => updateField('paperSize', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        >
                          <option value="A4">A4 (210×297mm)</option>
                          <option value="A5">A5 (148×210mm)</option>
                          <option value="thermal">Thermal (58mm)</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="fontFamily">Fuente</Label>
                        <select
                          id="fontFamily"
                          value={formData.fontFamily}
                          onChange={(e) => updateField('fontFamily', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        >
                          <option value="Arial">Arial</option>
                          <option value="Helvetica">Helvetica</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Courier New">Courier New</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="fontSize">Tamaño de fuente</Label>
                        <Input
                          id="fontSize"
                          type="number"
                          value={formData.fontSize}
                          onChange={(e) => updateField('fontSize', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">Impuestos</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="taxPercentage">IGV (%)</Label>
                        <Input
                          id="taxPercentage"
                          type="number"
                          step="0.01"
                          value={formData.taxPercentage}
                          onChange={(e) => updateField('taxPercentage', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="footerText">Texto de pie</Label>
                        <Input
                          id="footerText"
                          value={formData.footerText || ''}
                          onChange={(e) => updateField('footerText', e.target.value)}
                          placeholder="Gracias por su preferencia"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">Campos a mostrar</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'showLogo', label: 'Logo' },
                        { key: 'showCompany', label: 'Datos de empresa' },
                        { key: 'showCustomer', label: 'Datos del cliente' },
                        { key: 'showEmployee', label: 'Vendedor' },
                        { key: 'showItems', label: 'Productos' },
                        { key: 'showSaleNumber', label: 'Número de venta' },
                        { key: 'showSaleDate', label: 'Fecha' },
                        { key: 'showSaleTime', label: 'Hora' },
                        { key: 'showPaymentMethod', label: 'Método de pago' },
                        { key: 'showSubtotal', label: 'Subtotal' },
                        { key: 'showTax', label: 'IGV' },
                        { key: 'showDiscount', label: 'Descuento' },
                      ].map((field) => (
                        <label key={field.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData[field.key as keyof typeof formData] as boolean}
                            onChange={(e) => updateField(field.key, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => updateField('isDefault', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Establecer como plantilla por defecto</span>
                  </label>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/invoices/templates')}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar Plantilla'}
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'preview' && (
                <div className="p-6">
                  {renderPreview()}
                </div>
              )}
            </Card>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Vista Previa en Tiempo Real</h3>
              <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {renderPreview()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThermalPreview({ formData }: { formData: Omit<InvoiceTemplate, 'id'> }) {
  const subtotal = sampleItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (formData.taxPercentage / 100);
  const total = subtotal + tax;

  return (
    <div className="bg-slate-100 p-4" style={{ fontFamily: 'Courier New, monospace', fontSize: '10px' }}>
      <div 
        className="mx-auto bg-white p-3 shadow-lg"
        style={{ width: '200px', minHeight: '400px' }}
      >
        <div className="text-center border-b border-dashed border-slate-300 pb-2 mb-2">
          {formData.showLogo && formData.logoUrl && (
            <img src={formData.logoUrl} alt="Logo" className="mx-auto mb-1" style={{ maxHeight: '30px' }} />
          )}
          {formData.showCompany && (
            <>
              <div className="font-bold uppercase text-xs">Mi Empresa</div>
              {formData.companyRuc && <div className="text-xs">RUC: {formData.companyRuc}</div>}
              {formData.companyAddress && <div className="text-xs">{formData.companyAddress}</div>}
              {formData.companyPhone && <div className="text-xs">Tel: {formData.companyPhone}</div>}
            </>
          )}
          <div className="my-1 border-t border-b border-dashed border-slate-300 py-1">
            <div className="font-bold text-xs">{formData.type} DE VENTA</div>
            {formData.showSaleNumber && <div className="text-xs">N° 0001-00001</div>}
          </div>
        </div>

        {formData.showCustomer && (
          <div className="mb-2 border-b border-dashed border-slate-300 pb-2 text-xs">
            {formData.showSaleDate && <div>Fecha: 16/03/2026</div>}
            {formData.showSaleTime && <div>Hora: 14:30</div>}
            <div>Cliente: Cliente General</div>
            <div>DNI: 75421968</div>
          </div>
        )}

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left py-1">Producto</th>
              <th className="text-center py-1">Cant</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {sampleItems.map((item, i) => (
              <tr key={i}>
                <td className="py-0.5">{item.name}</td>
                <td className="text-center py-0.5">{item.quantity}</td>
                <td className="text-right py-0.5">S/ {item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 border-t border-dashed border-slate-300 pt-2 text-xs">
          {formData.showSubtotal && (
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>S/ {subtotal.toFixed(2)}</span>
            </div>
          )}
          {formData.showTax && (
            <div className="flex justify-between">
              <span>IGV ({formData.taxPercentage}%):</span>
              <span>S/ {tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-slate-300">
            <span>TOTAL:</span>
            <span>S/ {total.toFixed(2)}</span>
          </div>
        </div>

        {formData.showPaymentMethod && (
          <div className="mt-2 text-center text-xs">
            Pago: Efectivo
          </div>
        )}

        <div className="mt-3 text-center text-xs border-t border-dashed border-slate-300 pt-2">
          <p>{formData.footerText || 'Gracias por su preferencia'}</p>
        </div>
      </div>
    </div>
  );
}

function StandardPreview({ formData }: { formData: Omit<InvoiceTemplate, 'id'> }) {
  const subtotal = sampleItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (formData.taxPercentage / 100);
  const total = subtotal + tax;

  const paperWidth = formData.paperSize === 'A5' ? '420px' : '600px';

  return (
    <div className="bg-slate-100 p-4 overflow-auto">
      <div 
        className="mx-auto bg-white shadow-lg"
        style={{ width: paperWidth, minHeight: '700px', fontFamily: formData.fontFamily }}
      >
        <div 
          className="text-center py-4 px-6 border-b-2"
          style={{ borderColor: '#1a1a2e' }}
        >
          {formData.showLogo && formData.logoUrl && (
            <img src={formData.logoUrl} alt="Logo" className="mx-auto mb-2" style={{ maxHeight: '50px' }} />
          )}
          {formData.showCompany && (
            <>
              <div className="text-xl font-bold uppercase" style={{ color: '#1a1a2e' }}>
                Mi Empresa SAC
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {formData.companyRuc && <span>RUC: {formData.companyRuc}</span>}
                {formData.companyRuc && formData.companyAddress && <span> | </span>}
                {formData.companyAddress && <span>{formData.companyAddress}</span>}
                {formData.companyPhone && <span> | Tel: {formData.companyPhone}</span>}
              </div>
            </>
          )}
          <div className="text-base font-bold mt-3" style={{ color: '#1a1a2e' }}>
            {formData.type} DE VENTA
          </div>
          {formData.showSaleNumber && (
            <div className="text-sm text-slate-600">N° 0001-00001</div>
          )}
        </div>

        {formData.showCustomer && (
          <div className="px-6 py-3 flex gap-4">
            <div className="flex-1 bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase">Fecha</div>
              <div className="text-sm font-medium">16/03/2026</div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase">Cliente</div>
              <div className="text-sm font-medium">Juan Pérez</div>
            </div>
            <div className="flex-1 bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase">Documento</div>
              <div className="text-sm font-medium">DNI 75421968</div>
            </div>
          </div>
        )}

        <table className="w-full px-6" style={{ fontSize: `${formData.fontSize}px` }}>
          <thead>
            <tr style={{ backgroundColor: '#1a1a2e', color: 'white' }}>
              <th className="text-left py-2 px-3">Producto</th>
              <th className="text-center py-2 px-3">Cant.</th>
              <th className="text-right py-2 px-3">P. Unit</th>
              <th className="text-right py-2 px-3">Importe</th>
            </tr>
          </thead>
          <tbody>
            {sampleItems.map((item, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 px-3">{item.name}</td>
                <td className="text-center py-2 px-3">{item.quantity}</td>
                <td className="text-right py-2 px-3">S/ {item.unitPrice.toFixed(2)}</td>
                <td className="text-right py-2 px-3">S/ {item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-3 flex justify-end">
          <table className="w-64">
            <tbody>
              {formData.showSubtotal && (
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-600">Subtotal</td>
                  <td className="py-2 text-right font-medium">S/ {subtotal.toFixed(2)}</td>
                </tr>
              )}
              {formData.showTax && (
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-600">IGV ({formData.taxPercentage}%)</td>
                  <td className="py-2 text-right font-medium">S/ {tax.toFixed(2)}</td>
                </tr>
              )}
              <tr style={{ backgroundColor: '#1a1a2e' }}>
                <td className="py-3 px-2 text-white font-bold">TOTAL A PAGAR</td>
                <td className="py-3 px-2 text-white text-right font-bold">S/ {total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {formData.showPaymentMethod && (
          <div className="px-6 py-2">
            <div className="inline-block bg-blue-50 rounded-lg px-4 py-2">
              <div className="text-xs text-slate-500 uppercase">Forma de Pago</div>
              <div className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>Efectivo</div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-100 mt-4">
          <p>{formData.footerText || 'Gracias por su preferencia'}</p>
          <p className="mt-1">{formData.type} N° 0001-00001 - Mi Empresa SAC</p>
        </div>
      </div>
    </div>
  );
}
