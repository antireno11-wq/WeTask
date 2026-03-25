import { Suspense } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  return (
    <main className="login-screen">
      <div className="login-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="login-stage login-stage-single">
          <div className="login-stage-copy">
            <p className="login-stage-kicker">Seguridad de cuenta</p>
            <h2>Elige una nueva contraseña para tu cuenta WeTask.</h2>
            <p>Usa el enlace que te llegó por correo y define una clave nueva para volver a entrar con normalidad.</p>
          </div>

          <Suspense fallback={<div className="login-panel-card"><p>Cargando recuperación...</p></div>}>
            <ResetPasswordClient />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
