type AppHeaderProps = {
  fullName: string;
  companyId: string | null;
  roles: string[];
};

export function AppHeader({ fullName, companyId, roles }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-foreground/10 bg-background/85 px-5 py-4 backdrop-blur md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground/45">Workspace</p>
          <h1 className="font-display text-2xl">Multi-tenant operations</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-foreground/10 bg-white px-4 py-2 text-sm text-foreground/68">
            {companyId ? `Tenant: ${companyId}` : 'Vista SaaS global'}
          </div>
          <div className="rounded-full border border-foreground/10 bg-white px-4 py-2 text-sm text-foreground/68">
            {fullName} · {roles.join(', ')}
          </div>
        </div>
      </div>
    </header>
  );
}
