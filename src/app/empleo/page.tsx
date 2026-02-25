import { MarketNav } from "@/components/market-nav";

export default function EmpleoPage() {
  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel minimal-info">
        <h2>Empleo</h2>
        <p>Estamos construyendo un equipo para escalar WeTask en Chile.</p>
        <p>Si te interesa producto, operaciones o crecimiento, escríbenos a contacto@wetask.cl.</p>
      </section>
    </main>
  );
}
