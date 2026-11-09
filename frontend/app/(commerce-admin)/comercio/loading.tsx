export default function CommerceLoading() {
  return (
    <div role="status" className="space-y-4 p-6">
      <p className="font-display text-xl">Cargando tu tienda…</p>
      <div className="h-32 animate-pulse rounded-2xl bg-foreground/5 motion-reduce:animate-none" />
    </div>
  );
}
