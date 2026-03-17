'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Search, Loader2, Check, AlertCircle, User, X, FileText, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';

interface CustomerData {
  id?: string;
  firstName?: string;
  lastName?: string;
  documentType?: string;
  documentValue?: string;
  email?: string;
  phone?: string;
  direccion?: string;
}

interface ApiCustomer {
  id: string;
  firstName: string;
  lastName?: string | null;
  documentType?: string | null;
  documentValue?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface CustomerSearchProps {
  onSelect?: (customer: CustomerData) => void;
  showExisting?: boolean;
  customers?: ApiCustomer[];
}

export function CustomerSearch({ onSelect, showExisting = true, customers = [] }: CustomerSearchProps) {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [documentType, setDocumentType] = useState<'DNI' | 'RUC'>('DNI');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<CustomerData | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  const filteredCustomers = showExisting && searchQuery.length >= 1
    ? customers.filter(c => 
        c.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.documentValue?.includes(searchQuery)
      ).slice(0, 5)
    : [];

  const searchDocument = useCallback(async () => {
    if (!searchQuery || 
        (documentType === 'DNI' && searchQuery.length !== 8) || 
        (documentType === 'RUC' && searchQuery.length !== 11)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setResult(null);
    setSelectedCustomer(null);

    try {
      if (documentType === 'DNI') {
        const data = await apiFetch<{
          dni: string;
          nombre?: string;
          apellidoPaterno?: string;
          apellidoMaterno?: string;
          nombres?: string;
          telefono?: string;
          direccion?: string;
        }>(`/dni/${searchQuery}`, {
          token: session?.accessToken,
        });

        if (data) {
          setResult({
            firstName: data.nombres || data.apellidoPaterno || '',
            lastName: data.apellidoPaterno && data.apellidoMaterno 
              ? `${data.apellidoPaterno} ${data.apellidoMaterno}`
              : data.apellidoPaterno || '',
            documentType: 'DNI',
            documentValue: data.dni,
            phone: data.telefono,
          });
          setSuccess(true);
        }
      } else {
        const data = await apiFetch<{
          ruc: string;
          nombre: string;
          direccion?: string;
          estado?: string;
        }>(`/dni/ruc/${searchQuery}`, {
          token: session?.accessToken,
        });

        if (data) {
          setResult({
            firstName: data.nombre,
            lastName: '',
            documentType: 'RUC',
            documentValue: data.ruc,
            direccion: data.direccion,
          });
          setSuccess(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se encontraron datos');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, documentType, session?.accessToken]);

  const handleSelectCustomer = (customer: ApiCustomer) => {
    const customerData: CustomerData = {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName ?? undefined,
      documentType: customer.documentType ?? undefined,
      documentValue: customer.documentValue ?? undefined,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
    };
    setSelectedCustomer(customerData);
    setSearchQuery(customer.documentValue || `${customer.firstName} ${customer.lastName}`);
    setShowDropdown(false);
    onSelect?.(customerData);
  };

  const handleSelectResult = () => {
    if (result) {
      setSelectedCustomer(result);
      onSelect?.(result);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setResult(null);
    setSelectedCustomer(null);
    setError(null);
    setSuccess(false);
    onSelect?.(null as unknown as CustomerData);
  };

  const isValidLength = documentType === 'DNI' ? searchQuery.length === 8 : searchQuery.length === 11;

  useEffect(() => {
    if (isValidLength && searchQuery) {
      searchDocument();
    }
  }, [searchQuery, documentType]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setDocumentType('DNI'); setResult(null); setSelectedCustomer(null); }}
          className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            documentType === 'DNI'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <User className="h-4 w-4" />
          DNI
        </button>
        <button
          type="button"
          onClick={() => { setDocumentType('RUC'); setResult(null); setSelectedCustomer(null); }}
          className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            documentType === 'RUC'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          RUC
        </button>
      </div>

      <div className="relative">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                const maxLength = documentType === 'DNI' ? 8 : 11;
                setSearchQuery(value.slice(0, maxLength));
                setShowDropdown(true);
                setResult(null);
                setSelectedCustomer(null);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={documentType === 'DNI' ? 'Buscar por DNI (8 dígitos)' : 'Buscar por RUC (11 dígitos)'}
              className={`h-12 rounded-xl border-2 bg-slate-50/50 pl-10 pr-20 transition-all ${
                success 
                  ? 'border-emerald-500 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-500/20' 
                  : error 
                    ? 'border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20'
                    : isValidLength
                      ? 'border-blue-500 bg-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : success ? (
                <Check className="h-5 w-5 text-emerald-500" />
              ) : searchQuery.length > 0 && !isValidLength ? (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              ) : (
                <Search className="h-5 w-5 text-slate-400" />
              )}
            </div>
            {selectedCustomer && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-slate-600" />
              </button>
            )}
          </div>
        </div>

        {showExisting && filteredCustomers.length > 0 && !selectedCustomer && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl max-h-60 overflow-y-auto">
            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelectCustomer(customer)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {customer.documentValue || 'Sin documento'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && !selectedCustomer && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">
                  {documentType === 'DNI' ? 'Datos encontrados' : 'Empresa encontrada'}
                </p>
              </div>
              <p className="font-bold text-emerald-900 text-lg">
                {documentType === 'DNI' 
                  ? `${result.firstName} ${result.lastName}`.trim()
                  : result.firstName
                }
              </p>
              {result.phone && (
                <p className="text-sm text-emerald-700 mt-1">Tel: {result.phone}</p>
              )}
              {result.direccion && (
                <p className="text-sm text-emerald-700">{result.direccion}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSelectResult}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors"
            >
              Usar datos
            </button>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <User className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-900">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </p>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <FileText className="h-3 w-3" />
                {selectedCustomer.documentType}: {selectedCustomer.documentValue}
                {selectedCustomer.email && (
                  <>
                    <span className="text-slate-300">|</span>
                    {selectedCustomer.email}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <X className="h-4 w-4 text-blue-500" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <AlertCircle className="h-3 w-3" />
        <span>La búsqueda es opcional. Puedes registrar la venta sin cliente.</span>
      </div>
    </div>
  );
}
