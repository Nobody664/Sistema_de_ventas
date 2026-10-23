import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { SupportFaqList } from "@/components/support/support-faq-list";
import type { PaginatedSupportFaqs, SupportFaq } from "@/types/support";
import { BookOpen } from "lucide-react";

export default async function SupportFaqsPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const result = await serverApiFetch<PaginatedSupportFaqs>(
    "/support/faqs?limit=100",
    accessToken,
  );
  const faqs: SupportFaq[] = result?.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white sm:p-8 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/20 p-3">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">
              Preguntas frecuentes
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Respuestas rápidas a las dudas más comunes
            </p>
          </div>
        </div>
      </Card>

      <SupportFaqList faqs={faqs} />
    </div>
  );
}
