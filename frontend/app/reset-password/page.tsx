import { Suspense } from "react";
import { ResetPasswordPageClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="size-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordPageClient />
    </Suspense>
  );
}
