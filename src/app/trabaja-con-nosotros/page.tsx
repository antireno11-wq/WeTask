import Link from "next/link";
import { MarketNav } from "@/components/market-nav";
import { CORE_SERVICES } from "@/lib/core-services";

export default function TrabajaConNosotrosPage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel mvp-hero">
        <p className="mvp-kicker">Registro de profesionales</p>
        <h1>Elige el servicio que ofreces</h1>
        <p className="lead">Cada servicio tiene preguntas distintas en el onboarding.</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Selecciona tu especialidad</h2>
          <p>Entraras al registro del servicio que elijas y luego completas todo en una sola pagina (hacia abajo).</p>
        </div>
        <div className="mvp-why-grid">
          {CORE_SERVICES.map((service) => (
            <article key={service.slug} className="mvp-why-card">
              <h3>{service.label}</h3>
              <p>{service.taskerDescription}</p>
              <Link href={`/trabaja-con-nosotros/registro?service=${service.slug}`} className="cta small">
                Continuar con {service.label}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
