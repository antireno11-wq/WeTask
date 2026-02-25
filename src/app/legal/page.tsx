import { MarketNav } from "@/components/market-nav";

export default function LegalPage() {
  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel minimal-info">
        <h2>Legal</h2>
        <p>Aquí publicaremos términos y condiciones, política de privacidad y reglas de uso de la plataforma.</p>
        <p>Para consultas legales o de datos personales, escríbenos a legal@wetask.cl.</p>
      </section>
    </main>
  );
}
