'use client';

import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Check, AlertCircle } from 'lucide-react';

interface PaymentProofUploaderProps {
  subscriptionId: string;
  amount: string;
  provider: string;
  onSuccess?: () => void;
}

interface PaymentSettings {
  qrImageBase64?: string;
  accountNumber?: string;
  accountName?: string;
  instructions?: string;
}

export function PaymentProofUploader({ subscriptionId, amount, provider, onSuccess }: PaymentProofUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPaymentSettings = async () => {
    try {
      const data = await apiFetch<PaymentSettings>(`/payments/settings/provider/${provider}`);
      setPaymentSettings(data);
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!proofImage) {
      setMessage({ type: 'error', text: 'Por favor sube una imagen del comprobante' });
      return;
    }

    setLoading(true);
    try {
      await apiFetch(`/payments/settings/proof/${subscriptionId}`, {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: proofImage,
          amount: amount,
        }),
      });
      
      setUploaded(true);
      setMessage({ type: 'success', text: 'Comprobante subido correctamente. Tu suscripción será activada tras verificación.' });
      onSuccess?.();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al subir el comprobante' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {!paymentSettings && (
        <Button variant="outline" onClick={fetchPaymentSettings} className="w-full">
          Cargar datos de pago
        </Button>
      )}

      {paymentSettings && (
        <>
          <Card className="rounded-2xl bg-white p-6">
            <h3 className="font-display text-lg mb-4">Instrucciones de pago</h3>
            
            {paymentSettings.qrImageBase64 && (
              <div className="mb-4">
                <p className="text-sm text-foreground/60 mb-2">Escanea el código QR con tu app:</p>
                <div className="flex justify-center">
                  <img 
                    src={paymentSettings.qrImageBase64} 
                    alt="QR Code" 
                    className="w-48 h-48 object-contain border rounded-xl"
                  />
                </div>
              </div>
            )}

            {paymentSettings.accountNumber && (
              <div className="space-y-2 text-sm">
                <p><strong>Número:</strong> {paymentSettings.accountNumber}</p>
                {paymentSettings.accountName && (
                  <p><strong>Titular:</strong> {paymentSettings.accountName}</p>
                )}
              </div>
            )}

            {paymentSettings.instructions && (
              <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
                <p className="text-sm">{paymentSettings.instructions}</p>
              </div>
            )}

            <div className="mt-4 p-3 bg-violet-50 rounded-lg">
              <p className="text-sm text-violet-700">
                <strong>Monto a pagar:</strong> S/ {amount}
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl bg-white p-6">
            <h3 className="font-display text-lg mb-4">Subir comprobante</h3>
            
            <div className="space-y-4">
              <div>
                <Label>Captura de pantalla o foto del comprobante</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />
                  
                  {proofImage ? (
                    <div className="space-y-3">
                      <img 
                        src={proofImage} 
                        alt="Comprobante" 
                        className="w-full max-h-64 object-contain border rounded-xl"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setProofImage(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        Cambiar imagen
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-foreground/20 rounded-xl cursor-pointer hover:bg-foreground/5 transition">
                      <Upload className="w-8 h-8 text-foreground/40" />
                      <span className="mt-2 text-sm text-foreground/60">Haz clic para subir</span>
                    </label>
                  )}
                </div>
              </div>

              {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span className="text-sm">{message.text}</span>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={loading || !proofImage || uploaded}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : uploaded ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Comprobante subido
                  </>
                ) : (
                  'Confirmar pago'
                )}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
