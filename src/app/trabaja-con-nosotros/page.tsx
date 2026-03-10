import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

export default function TrabajaConNosotrosPage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel mvp-hero">
        <p className="mvp-kicker">Onboarding limpieza por hora</p>
        <h1>Gana dinero ofreciendo servicios de limpieza</h1>
        <p className="lead">Registro por etapas: crea cuenta rapido, completa perfil y activa tu servicio con revision manual.</p>

        <div className="cta-row mvp-hero-actions">
          <Link href="/trabaja-con-nosotros/registro" className="cta">
            Iniciar onboarding
          </Link>
          <Link href="/ingresar/tasker" className="cta ghost">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Que vas a configurar</h2>
          <p>Perfil profesional, servicios, cobertura, agenda, tarifas, verificacion y capacitacion obligatoria.</p>
        </div>
        <ul className="mvp-trust-list">
          <li>✔ Servicio base por hora con reserva minima</li>
          <li>✔ Cobertura por comunas y radio de desplazamiento</li>
          <li>✔ Verificacion de identidad y antecedentes</li>
          <li>✔ Activacion manual por administrador</li>
        </ul>
      </section>
    </main>
  );
}
