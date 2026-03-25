import { Suspense } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { ResetPasswordClient } from "./reset-password-client";

export default function ResetPasswordPage() {
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Seguridad de cuenta</p>
            <h1>Elige una nueva contraseña para tu cuenta WeTask.</h1>
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
