import type { Metadata } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
});

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Ventas SaaS',
  description: 'Plataforma SaaS multi-empresa para ventas, inventario y suscripciones.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${displayFont.variable} ${bodyFont.variable} font-body antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

