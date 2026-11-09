"use client";

export default function CommerceError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-foreground/15 p-8">
      <h2 className="font-display text-2xl font-semibold">
        No pudimos cargar esta sección
      </h2>
      <p className="my-4 text-foreground/60">
        Vuelve a intentarlo para recuperar los datos de tu tienda.
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-primary px-5 py-3 text-primary-foreground"
      >
        Reintentar
      </button>
    </div>
  );
}
