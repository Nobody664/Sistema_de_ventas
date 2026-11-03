"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/store/ui-store";

export function AvatarUpload({
  avatarUrl,
  fullName,
  className = "h-20 w-20 text-3xl sm:h-28 sm:w-28 sm:text-5xl",
  fallbackClassName = "bg-white/10 text-white",
}: {
  avatarUrl?: string | null;
  fullName: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const router = useRouter();
  const updateAvatar = useAuthStore((state) => state.updateAvatar);
  const addToast = useUiStore((state) => state.addToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreview(avatarUrl ?? "");
  }, [avatarUrl]);

  const initials = (fullName || "Usuario")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const save = async (value: string | null) => {
    setBusy(true);
    try {
      await updateAvatar(value);
      setPreview(value ?? "");
      addToast(
        value ? "Foto de perfil actualizada" : "Foto de perfil eliminada",
        "success",
      );
      router.refresh();
    } catch (error) {
      setPreview(avatarUrl ?? "");
      addToast(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la foto",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      addToast("Selecciona una imagen PNG, JPEG o WebP", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast("La imagen no debe superar los 5 MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => addToast("No se pudo leer la imagen", "error");
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPreview(reader.result);
        void save(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar className={`${className} border border-white/20 shadow-lg`}>
        {preview && (
          <AvatarImage
            src={preview}
            alt={`Foto de ${fullName || "usuario"}`}
            className="object-cover"
          />
        )}
        <AvatarFallback className={fallbackClassName}>
          {busy ? <Loader2 className="size-6 animate-spin" /> : initials}
        </AvatarFallback>
      </Avatar>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50"
        >
          <Camera className="size-3.5" />
          Cambiar foto
        </button>
        {preview && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(null)}
            aria-label="Eliminar foto de perfil"
            className="rounded-full bg-white/10 p-1.5 text-white/80 backdrop-blur-sm transition hover:bg-red-500/30 hover:text-white disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
