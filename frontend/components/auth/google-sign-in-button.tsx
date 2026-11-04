"use client";

import { Loader2 } from "lucide-react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSignInDestination } from "@/lib/role-navigation";
import { useAuthStore } from "@/stores/auth.store";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityServices {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
    },
  ): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityServices;
      };
    };
  }
}

export function GoogleSignInButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const buttonRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const credentialHandlerRef = useRef<
    (response: GoogleCredentialResponse) => void
  >(() => undefined);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential || submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);
      setError(null);

      try {
        await loginWithGoogle(response.credential);
        router.replace(
          getSignInDestination(
            searchParams.get("redirect"),
            useAuthStore.getState().user?.roles ?? [],
          ),
        );
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo iniciar sesión con Google",
        );
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [loginWithGoogle, router, searchParams],
  );

  credentialHandlerRef.current = (response) => {
    void handleCredential(response);
  };

  const handleScriptLoad = useCallback(() => {
    const google = window.google;
    const container = buttonRef.current;
    if (!GOOGLE_CLIENT_ID || !google || !container) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => credentialHandlerRef.current(response),
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    container.replaceChildren();
    google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      width: 320,
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    return () => window.google?.accounts.id.cancel();
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <div className="space-y-2">
        <div
          ref={buttonRef}
          className="flex min-h-12 items-center justify-center"
          aria-busy={isSubmitting}
        />
        {!isReady && !isSubmitting ? (
          <p className="flex items-center justify-center gap-2 text-xs text-white/40">
            <Loader2 className="size-3 animate-spin" />
            Cargando Google...
          </p>
        ) : null}
        {isSubmitting ? (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 text-xs text-white/60"
          >
            <Loader2 className="size-3 animate-spin" />
            Verificando cuenta de Google...
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-center text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#0a0a0a] px-3 text-white/40">
            o continúa con tu correo
          </span>
        </div>
      </div>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
        onError={() => setError("No se pudo cargar Google. Intenta de nuevo.")}
      />
    </>
  );
}
