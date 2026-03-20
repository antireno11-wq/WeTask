import { AuthHeroNav } from "@/components/auth-hero-nav";
import { VerifyEmailClient } from "@/app/verificar-correo/verify-email-client";

type VerifyEmailPageProps = {
  searchParams?: {
    token?: string;
  };
};

export default function VerificarCorreoPage({ searchParams }: VerifyEmailPageProps) {
  const token = searchParams?.token?.trim() ?? "";

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Verificación de correo</p>
            <h1>Estamos confirmando tu cuenta de WeTask.</h1>
            <p>Este paso protege tu acceso y asegura que tu correo quedó correctamente asociado a tu cuenta.</p>
          </div>

          {token ? (
            <VerifyEmailClient token={token} />
          ) : (
            <section className="auth-flow-panel auth-flow-panel-wide">
              <div className="panel-head auth-flow-panel-head">
                <h2>Enlace inválido</h2>
                <p>No encontramos un token de verificación válido en este enlace.</p>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
