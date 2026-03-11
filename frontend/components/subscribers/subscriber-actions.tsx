'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Check, X, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/lib/api';
import { useSession } from 'next-auth/react';
import type { SubscriberWithCompany } from '@/types/api';

interface SubscriberActionsProps {
  subscriber: SubscriberWithCompany;
}

export function SubscriberActions({ subscriber }: SubscriberActionsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading('approve');
    try {
      await apiFetch(`/subscriptions/subscribers/${subscriber.id}/approve`, {
        method: 'PATCH',
        token: session?.accessToken,
      });
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    } catch (error) {
      console.error('Error approving subscriber:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    try {
      await apiFetch(`/subscriptions/subscribers/${subscriber.id}/reject`, {
        method: 'PATCH',
        token: session?.accessToken,
      });
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
    } catch (error) {
      console.error('Error rejecting subscriber:', error);
    } finally {
      setLoading(null);
    }
  };

  const isPending = subscriber.status === 'TRIALING';
  const isActive = subscriber.status === 'ACTIVE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isPending && (
          <>
            <DropdownMenuItem onClick={handleApprove} disabled={!!loading}>
              <Check className="mr-2 size-4 text-green-600" />
              {loading === 'approve' ? 'Aprobando...' : 'Aprobar'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReject} disabled={!!loading}>
              <X className="mr-2 size-4 text-red-600" />
              {loading === 'reject' ? 'Rechazando...' : 'Rechazar'}
            </DropdownMenuItem>
          </>
        )}
        {isActive && (
          <DropdownMenuItem>
            <ArrowUpCircle className="mr-2 size-4" />
            Cambiar plan
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
