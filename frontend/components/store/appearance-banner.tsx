import Image from "next/image";
import type { PublicStoreAppearance } from "@/lib/store-appearance";

export function AppearanceBanner({
  appearance,
  name,
  phone,
}: {
  appearance: PublicStoreAppearance;
  name: string;
  phone?: string | null;
}) {
  return (
    <section
      className="store-appearance-banner"
      aria-label="Presentación de la tienda"
    >
      <div className="min-w-0">
        {appearance.logoUrl && (
          <Image
            src={appearance.logoUrl}
            alt={`Logo de ${name}`}
            width={160}
            height={160}
            unoptimized
            className="mb-5 h-20 w-20 rounded-xl object-contain"
          />
        )}
        <p className="store-eyebrow">{name}</p>
        <h2 className="store-display">{appearance.headline}</h2>
        {appearance.showDescription && appearance.heroDescription && (
          <p className="store-description">{appearance.heroDescription}</p>
        )}
        {appearance.showBusinessPhone && phone && (
          <p className="mt-4 text-sm">Contacto: {phone}</p>
        )}
      </div>
      {appearance.coverUrl && (
        <Image
          src={appearance.coverUrl}
          alt={`Portada de ${name}`}
          width={1200}
          height={800}
          unoptimized
          className="max-h-80 w-full rounded-2xl object-cover"
        />
      )}
    </section>
  );
}
