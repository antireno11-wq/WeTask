import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

const taskerServices = [
  {
    slug: "limpieza",
    title: "Limpieza",
    description: "Onboarding completo con cobertura, tarifas y verificacion."
  },
  {
    slug: "maestro",
    title: "Maestro",
    description: "Registro para trabajos de reparaciones y mantenciones."
  },
  {
    slug: "clases",
    title: "Clases",
    description: "Registro para profes de apoyo escolar y clases personalizadas."
  }
] as const;

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
          {taskerServices.map((service) => (
            <article key={service.slug} className="mvp-why-card">
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <Link href={`/trabaja-con-nosotros/registro?service=${service.slug}`} className="cta small">
                Continuar con {service.title}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
