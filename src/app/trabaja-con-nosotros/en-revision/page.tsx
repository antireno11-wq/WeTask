import Link from "next/link";
import type { Metadata } from "next";
import { MarketNav } from "@/components/market-nav";

export const metadata: Metadata = {
  title: "Tu perfil está en revisión — WeTask",
  description: "Recibimos tu solicitud para trabajar en WeTask. Estamos revisando tus datos."
};

export default function OnboardingEnRevisionPage() {
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide" style={{ display: "grid", gap: 24 }}>
          <section
            className="auth-flow-panel auth-flow-panel-wide"
            style={{
              padding: 40,
              textAlign: "center",
              display: "grid",
              gap: 18,
              placeItems: "center"
            }}
          >
            <div
              aria-hidden
              style={{
                width: 88,
                height: 88,
                borderRadius: 999,
                background: "linear-gradient(135deg,#76f2c0 0%,#18a6d5 100%)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 18px 36px rgba(24,166,213,0.32)"
              }}
            >
              <svg viewBox="0 0 24 24" width="44" height="44" fill="none" aria-hidden>
                <path
                  d="M5 12.5l4 4 10-10"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p className="auth-flow-kicker" style={{ margin: 0 }}>Estás casi adentro</p>
            <h1 style={{ margin: 0, fontSize: 32, color: "#17324d", maxWidth: 520 }}>
              ¡Recibimos tu perfil! Lo estamos revisando.
            </h1>
            <p style={{ maxWidth: 560, color: "#48627d", fontSize: 17, lineHeight: 1.6, margin: 0 }}>
              Validamos tus documentos y datos manualmente. Te avisamos por correo en cuanto haya respuesta —
              normalmente <strong>en menos de 48 horas</strong>.
            </p>

            <div
              style={{
                marginTop: 6,
                padding: "16px 20px",
                borderRadius: 16,
                background: "#f4f8fd",
                border: "1px solid rgba(29,127,198,0.18)",
                maxWidth: 560,
                width: "100%",
                textAlign: "left"
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "#5f7691", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700 }}>
                Qué sigue
              </p>
              <ol style={{ margin: "10px 0 0 18px", padding: 0, color: "#17324d", lineHeight: 1.7 }}>
                <li>Revisamos identidad, cobertura, tarifas y documentos.</li>
                <li>Te enviamos un correo cuando aprobemos (o si necesitamos algo más).</li>
                <li>Conectas MercadoPago para empezar a recibir reservas pagadas.</li>
              </ol>
            </div>

            <div className="cta-row" style={{ marginTop: 12 }}>
              <Link href="/" className="cta">
                Volver al inicio
              </Link>
              <Link href="/trabaja-con-nosotros/registro" className="cta ghost">
                Revisar mi solicitud
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
