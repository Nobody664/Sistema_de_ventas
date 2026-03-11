'use client';

import { LogOut, Settings, User } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type AppHeaderProps = {
  fullName: string;
  companyId: string | null;
  roles: string[];
  email: string;
};

export function AppHeader({ fullName, companyId, roles, email }: AppHeaderProps) {
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/sign-in' });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-foreground/10 bg-background/85 px-5 py-4 backdrop-blur md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground/45">Workspace</p>
          <h1 className="font-display text-2xl">Multi-tenant operations</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-full border border-foreground/10 bg-white px-3 py-1.5 pr-4 text-sm transition hover:border-foreground/20 hover:bg-gray-50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground/68">{fullName}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-foreground/10 p-2">
              <DropdownMenuLabel className="pb-2">
                <div className="flex flex-col">
                  <span className="font-medium">{fullName}</span>
                  <span className="text-xs font-normal text-foreground/50">{email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              <Link href="/profile" className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-gray-100">
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </Link>
              <Link href="/settings" className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm text-foreground hover:bg-gray-100">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </Link>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                className="rounded-xl px-3 py-2 cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
