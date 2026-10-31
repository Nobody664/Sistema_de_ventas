"use client";

import { createContext, useContext, type ReactNode } from "react";
import { translate, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("es");
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
export function useT() {
  const locale = useLocale();
  return (text: string): string => translate(locale, text);
}
