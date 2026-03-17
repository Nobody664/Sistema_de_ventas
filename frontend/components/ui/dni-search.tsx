'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Search, Loader2, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';

interface DniResult {
  dni: string;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombres?: string;
  telefono?: string;
  direccion?: string;
}

interface DniSearchProps {
  onResult?: (data: {
    firstName: string;
    lastName: string;
    phone?: string;
    address?: string;
  }) => void;
  documentType?: string;
}

export function DniSearch({ onResult, documentType = 'DNI' }: DniSearchProps) {
  const { data: session } = useSession();
  const [documentNumber, setDocumentNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<DniResult | null>(null);

  const searchDocument = useCallback(async () => {
    if (!documentNumber || documentNumber.length < 8) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setResult(null);

    try {
      if (documentType === 'DNI') {
        const data = await apiFetch<DniResult>(`/dni/${documentNumber}`, {
          token: session?.accessToken,
        });

        if (data) {
          setResult(data);
          setSuccess(true);
          
          const fullName = data.nombres || data.apellidoPaterno || '';
          const lastName = data.apellidoPaterno && data.apellidoMaterno 
            ? `${data.apellidoPaterno} ${data.apellidoMaterno}`
            : data.apellidoPaterno || '';

          onResult?.({
            firstName: fullName,
            lastName: lastName,
            phone: data.telefono,
            address: data.direccion,
          });
        }
      } else {
        const data = await apiFetch<DniResult>(`/dni/ruc/${documentNumber}`, {
          token: session?.accessToken,
        });

        if (data) {
          setResult(data);
          setSuccess(true);
          
          onResult?.({
            firstName: data.nombre || '',
            lastName: '',
            phone: data.telefono,
            address: data.direccion,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se encontraron datos');
    } finally {
      setLoading(false);
    }
  }, [documentNumber, documentType, session?.accessToken, onResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchDocument();
    }
  };

  const handleChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const maxLength = documentType === 'DNI' ? 8 : 11;
    setDocumentNumber(numericValue.slice(0, maxLength));
    setSuccess(false);
    setResult(null);
    setError(null);
  };

  const isValidLength = documentType === 'DNI' 
    ? documentNumber.length === 8 
    : documentNumber.length === 11;

  return (
    <div className="space-y-2">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Input
            value={documentNumber}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={documentType === 'DNI' ? 'Buscar por DNI (8 dígitos)' : 'Buscar por RUC (11 dígitos)'}
            className={`h-12 rounded-xl border-2 bg-slate-50/50 pr-10 transition-all ${
              success 
                ? 'border-emerald-500 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-500/20' 
                : error 
                  ? 'border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20'
                  : isValidLength
                    ? 'border-blue-500 bg-white focus:border-blue-500 focus:ring-blue-500/20'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            ) : success ? (
              <Check className="h-5 w-5 text-emerald-500" />
            ) : documentNumber.length > 0 && !isValidLength ? (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            ) : (
              <Search className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={searchDocument}
          disabled={loading || !isValidLength}
          className="h-12 px-4 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
      
      {result && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-sm font-medium text-emerald-800">
            {documentType === 'DNI' 
              ? `${result.nombres || ''} ${result.apellidoPaterno || ''} ${result.apellidoMaterno || ''}`.trim()
              : result.nombre || ''
            }
          </p>
          {result.direccion && (
            <p className="text-xs text-emerald-600 mt-1">{result.direccion}</p>
          )}
        </div>
      )}
      
      {documentType === 'DNI' && documentNumber.length > 0 && documentNumber.length < 8 && (
        <p className="text-xs text-amber-600">
          El DNI debe tener 8 dígitos
        </p>
      )}
      {documentType === 'RUC' && documentNumber.length > 0 && documentNumber.length < 11 && (
        <p className="text-xs text-amber-600">
          El RUC debe tener 11 dígitos
        </p>
      )}
    </div>
  );
}
