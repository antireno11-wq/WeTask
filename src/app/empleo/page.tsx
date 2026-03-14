import { AuthHeroNav } from "@/components/auth-hero-nav";

export default function EmpleoPage() {
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Empleo</p>
            <h1>Estamos armando el equipo que va a escalar WeTask en Chile.</h1>
            <p>Si te interesa construir producto, operaciones o crecimiento en un marketplace de servicios, conversemos.</p>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide minimal-info">
            <h2>Empleo</h2>
            <p>Estamos construyendo un equipo para escalar WeTask en Chile.</p>
            <p>Si te interesa producto, operaciones o crecimiento, escríbenos a contacto@wetask.cl.</p>
          </section>
        </section>
      </div>
    </main>
  );
}
