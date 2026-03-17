'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, Save, Edit2, Check, X } from 'lucide-react';

interface PaymentSettings {
  id: string;
  provider: string;
  isEnabled: boolean;
  qrImageBase64?: string;
  accountNumber?: string;
  accountName?: string;
  instructions?: string;
}

const paymentProviders = [
  { id: 'YAPE', name: 'Yape', icon: '💚', description: 'Pago con código QR Yape' },
  { id: 'PLIN', name: 'Plin', icon: '💙', description: 'Pago con código QR Plin' },
  { id: 'TRANSFER', name: 'Transferencia', icon: '🏦', description: 'Transferencia bancaria' },
  { id: 'STRIPE', name: 'Stripe', icon: '💳', description: 'Pago con tarjeta (Stripe)' },
  { id: 'MERCADOPAGO', name: 'MercadoPago', icon: '💚', description: 'Pago con MercadoPago' },
];

export function PaymentSettingsManager() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<PaymentSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const token = session?.accessToken as string | undefined;

  useEffect(() => {
    if (token) {
      fetchSettings();
    }
  }, [token]);

  const fetchSettings = async () => {
    try {
      const data = await apiFetch<PaymentSettings[]>('/payments/settings', { token });
      setSettings(data || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSettings = (provider: string) => {
    return settings.find(s => s.provider === provider) || {
      id: '',
      provider,
      isEnabled: false,
      qrImageBase64: '',
      accountNumber: '',
      accountName: '',
      instructions: '',
    };
  };

  const handleToggleEnabled = async (provider: string, enabled: boolean) => {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch(`/payments/settings/provider/${provider}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: enabled }),
        token,
      });
      
      setSettings(prev => {
        const existing = prev.find(s => s.provider === provider);
        if (existing) {
          return prev.map(s => s.provider === provider ? { ...s, isEnabled: enabled } : s);
        }
        return [...prev, { id: '', provider, isEnabled: enabled, qrImageBase64: '', accountNumber: '', accountName: '', instructions: '' }];
      });
      
      if (enabled) {
        setEditingProvider(provider);
      } else {
        setEditingProvider(null);
      }
      
      setMessage({ type: 'success', text: `Proveedor ${enabled ? 'habilitado' : 'deshabilitado'} correctamente` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar configuración' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSaveSettings = async (provider: string, data: Partial<PaymentSettings>) => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await apiFetch<PaymentSettings>(`/payments/settings/provider/${provider}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      });
      
      setSettings(prev => {
        const existing = prev.find(s => s.provider === provider);
        if (existing) {
          return prev.map(s => s.provider === provider ? { ...s, ...updated } : s);
        }
        return [...prev, updated];
      });
      
      setEditingProvider(null);
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar configuración' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleImageUpload = (provider: string, file: File, onImageChange: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      onImageChange(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleCancelEdit = () => {
    setEditingProvider(null);
    fetchSettings();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-xl p-4 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {paymentProviders.map((provider) => {
          const providerSettings = getSettings(provider.id);
          const isEditing = editingProvider === provider.id;
          const isEnabled = providerSettings.isEnabled;
          
          return (
            <Card 
              key={provider.id} 
              className={`rounded-[30px] p-6 transition-all ${
                isEnabled 
                  ? isEditing 
                    ? 'bg-white border-2 border-violet-300 shadow-lg' 
                    : 'bg-white border-2 border-violet-200'
                  : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{provider.icon}</span>
                  <div>
                    <h3 className="font-display text-lg">{provider.name}</h3>
                    <p className="text-sm text-foreground/50">{provider.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggleEnabled(provider.id, checked)}
                  disabled={saving}
                />
              </div>

              {isEnabled && (
                <div className="mt-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      {['YAPE', 'PLIN'].includes(provider.id) && (
                        <>
                          <div>
                            <Label className="text-sm">Número de teléfono</Label>
                            <Input
                              placeholder="999999999"
                              value={providerSettings.accountNumber || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSettings(prev => prev.map(s => 
                                  s.provider === provider.id ? { ...s, accountNumber: value } : s
                                ));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Nombre del titular</Label>
                            <Input
                              placeholder="Juan Pérez"
                              value={providerSettings.accountName || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSettings(prev => prev.map(s => 
                                  s.provider === provider.id ? { ...s, accountName: value } : s
                                ));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Código QR</Label>
                            <div className="mt-2 space-y-3">
                              {providerSettings.qrImageBase64 && (
                                <div className="relative overflow-hidden rounded-xl border border-foreground/10">
                                  <img 
                                    src={providerSettings.qrImageBase64} 
                                    alt="QR Code" 
                                    className="w-full max-w-[200px] mx-auto"
                                  />
                                </div>
                              )}
                              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/20 px-4 py-3 text-sm hover:bg-foreground/5">
                                <Upload className="h-4 w-4" />
                                <span>Subir código QR</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleImageUpload(provider.id, file, (base64) => {
                                        setSettings(prev => prev.map(s => 
                                          s.provider === provider.id ? { ...s, qrImageBase64: base64 } : s
                                        ));
                                      });
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </>
                      )}

                      {provider.id === 'TRANSFER' && (
                        <>
                          <div>
                            <Label className="text-sm">Banco</Label>
                            <Input
                              placeholder="Banco de Crédito del Perú"
                              value={providerSettings.accountName || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSettings(prev => prev.map(s => 
                                  s.provider === provider.id ? { ...s, accountName: value } : s
                                ));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Número de cuenta</Label>
                            <Input
                              placeholder="201-0000000000"
                              value={providerSettings.accountNumber || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSettings(prev => prev.map(s => 
                                  s.provider === provider.id ? { ...s, accountNumber: value } : s
                                ));
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">CCI</Label>
                            <Input
                              placeholder="002-000-0000000000-00"
                              value={providerSettings.instructions || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSettings(prev => prev.map(s => 
                                  s.provider === provider.id ? { ...s, instructions: value } : s
                                ));
                              }}
                            />
                          </div>
                        </>
                      )}

                      {['STRIPE', 'MERCADOPAGO'].includes(provider.id) && (
                        <div>
                          <Label className="text-sm">Clave API</Label>
                          <Input
                            placeholder="sk_live_..."
                            type="password"
                            value={providerSettings.accountNumber || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSettings(prev => prev.map(s => 
                                s.provider === provider.id ? { ...s, accountNumber: value } : s
                              ));
                            }}
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => handleSaveSettings(provider.id, {
                            accountNumber: providerSettings.accountNumber,
                            accountName: providerSettings.accountName,
                            qrImageBase64: providerSettings.qrImageBase64,
                            instructions: providerSettings.instructions,
                          })}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                          Guardar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {['YAPE', 'PLIN'].includes(provider.id) && providerSettings.accountNumber && (
                        <div className="text-sm">
                          <p><strong>Teléfono:</strong> {providerSettings.accountNumber}</p>
                          {providerSettings.accountName && <p><strong>Titular:</strong> {providerSettings.accountName}</p>}
                          {providerSettings.qrImageBase64 && (
                            <div className="mt-2">
                              <img 
                                src={providerSettings.qrImageBase64} 
                                alt="QR Code" 
                                className="w-24 h-24 object-contain border rounded-lg"
                              />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {provider.id === 'TRANSFER' && providerSettings.accountNumber && (
                        <div className="text-sm">
                          <p><strong>Banco:</strong> {providerSettings.accountName}</p>
                          <p><strong>Cuenta:</strong> {providerSettings.accountNumber}</p>
                          {providerSettings.instructions && <p><strong>CCI:</strong> {providerSettings.instructions}</p>}
                        </div>
                      )}

                      {['STRIPE', 'MERCADOPAGO'].includes(provider.id) && providerSettings.accountNumber && (
                        <div className="text-sm">
                          <p><strong>API Configurada:</strong> ✓</p>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setEditingProvider(provider.id)}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Actualizar datos
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
