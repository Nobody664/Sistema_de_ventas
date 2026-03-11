'use client';

import { useUiStore } from '@/store/ui-store';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-lg border p-4 shadow-lg ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="size-5 text-green-600" />}
          {toast.type === 'error' && <AlertCircle className="size-5 text-red-600" />}
          {toast.type === 'info' && <Info className="size-5 text-blue-600" />}
          <p className="text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 rounded p-1 hover:bg-black/5"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
