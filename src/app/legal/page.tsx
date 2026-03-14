import { AuthHeroNav } from "@/components/auth-hero-nav";

export default function LegalPage() {
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Legal</p>
            <h1>Transparencia y resguardo para usuarios y profesionales.</h1>
            <p>Aquí reuniremos los términos, condiciones, política de privacidad y reglas generales de uso de WeTask.</p>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide minimal-info">
            <h2>Legal</h2>
            <p>Aquí publicaremos términos y condiciones, política de privacidad y reglas de uso de la plataforma.</p>
            <p>Para consultas legales o de datos personales, escríbenos a legal@wetask.cl.</p>
          </section>
        </section>
      </div>
    </main>
  );
}
