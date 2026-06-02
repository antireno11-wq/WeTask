import { AuthHeroNav } from "@/components/auth-hero-nav";

export default function OnboardingLoadingScreen() {
  return (
    <main className="auth-flow-screen">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Registro tasker</p>
            <h1>Estamos preparando tu registro.</h1>
            <p>En unos segundos podrás completar tu perfil profesional en WeTask.</p>
          </div>
          <section className="auth-flow-panel auth-flow-panel-wide">
            <p className="empty">Cargando registro...</p>
          </section>
        </section>
      </div>
    </main>
  );
}
