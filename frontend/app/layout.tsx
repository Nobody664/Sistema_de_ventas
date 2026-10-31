import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import { headers, cookies } from "next/headers";
import { LocaleProvider } from "@/components/settings/locale-provider";
import { localeFromValue } from "@/lib/i18n";
import { Providers } from "./providers";
import { ToastContainer } from "@/components/common/toast";
import "./globals.css";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Huanka-Saas",
  description:
    "Plataforma SaaS multi-empresa para ventas, inventario y suscripciones.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = localeFromValue((await cookies()).get("ventas_locale")?.value);
  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} font-body antialiased overflow-x-clip`}
      >
        <LocaleProvider locale={locale}>
          <Providers nonce={nonce}>
            {children}
            <ToastContainer />
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
