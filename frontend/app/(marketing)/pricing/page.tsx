import { Card } from '@/components/ui/card';

const pricingRows = [
  ['Usuarios', '3', '15', 'Ilimitados'],
  ['Productos', '500', '10,000', 'Ilimitados'],
  ['Sucursales', '1', '3', 'Ilimitadas'],
  ['Reportes avanzados', 'No', 'Sí', 'Sí'],
  ['Webhooks/API', 'No', 'Sí', 'Sí'],
];

export default function PricingPage() {
  return (
    <main className="container py-14">
      <span className="eyebrow">Pricing matrix</span>
      <h1 className="mt-5 font-display text-5xl md:text-6xl">Planes listos para operar desde el día uno.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/68">
        El cobro recurrente debe ser tan serio como el POS. Esta matriz es la base para Stripe, MercadoPago y
        PayPal con upgrades, downgrade y webhooks.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {[
          ['Start', '$19', 'Para comercios que necesitan salir rápido.'],
          ['Growth', '$59', 'Para empresas con equipo, inventario y reportes.'],
          ['Scale', '$149', 'Para operaciones con varias sedes y automatización.'],
        ].map(([name, price, copy], index) => (
          <Card key={name} className={`rounded-[34px] p-8 ${index === 1 ? 'bg-foreground text-white' : 'bg-white/80'}`}>
            <p className="text-sm uppercase tracking-[0.18em] opacity-60">{name}</p>
            <p className="mt-5 font-display text-6xl">{price}</p>
            <p className="mt-4 text-sm leading-7 opacity-70">{copy}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-10 overflow-hidden rounded-[34px] p-0">
        <div className="grid grid-cols-4 gap-px bg-border text-sm">
          {['Característica', 'Start', 'Growth', 'Scale', ...pricingRows.flat()].map((cell, index) => (
            <div
              key={`${cell}-${index}`}
              className={`bg-white px-5 py-4 ${index < 4 ? 'font-semibold text-foreground' : 'text-foreground/70'}`}
            >
              {cell}
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

