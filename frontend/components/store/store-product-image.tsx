"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";

export function StoreProductImage({
  src,
  name,
  compact = false,
}: {
  src?: string | null;
  name: string;
  compact?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = src?.trim();
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-stone-100 ${compact ? "size-20 rounded-xl" : "aspect-[4/3]"}`}
    >
      {source && source !== failedSource ? (
        <Image
          src={source}
          alt={name}
          fill
          unoptimized
          sizes={
            compact
              ? "80px"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          }
          onError={() => setFailedSource(source)}
          className={`object-contain transition-transform duration-300 motion-safe:group-hover:scale-105 ${compact ? "p-2" : "p-5"}`}
        />
      ) : (
        <Package
          aria-label={`Sin imagen de ${name}`}
          className={
            compact ? "size-7 text-stone-400" : "size-16 text-stone-300"
          }
        />
      )}
    </div>
  );
}
