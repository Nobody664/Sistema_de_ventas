import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border border-foreground/10 bg-card text-card-foreground shadow-halo', className)}
      {...props}
    />
  );
}

