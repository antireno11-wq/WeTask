import { MarketNav } from "@/components/market-nav";

export default function SobreNosotrosPage() {
  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel minimal-info">
        <h2>Sobre nosotros</h2>
        <p>WeTask es un marketplace chileno para conectar clientes y profesionales de servicios a domicilio.</p>
        <p>Nuestro foco es una experiencia simple, segura y transparente para reservar, trabajar y crecer en la plataforma.</p>
      </section>
    </main>
  );
}
