import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

const landingServices = [
  { key: "gasfiter", icon: "🔧", label: "Gasfiter" },
  { key: "electricista", icon: "⚡", label: "Electricista" },
  { key: "maestro-multiuso", icon: "🧰", label: "Maestro multiuso" },
  { key: "aire-acondicionado", icon: "❄️", label: "Aire acondicionado" },
  { key: "jardineria", icon: "🌿", label: "Jardineria" },
  { key: "reparaciones-hogar", icon: "🏠", label: "Reparaciones del hogar" }
];

const howItWorks = [
  {
    title: "1. Describe tu problema",
    text: "Cuentanos que necesitas reparar o instalar."
  },
  {
    title: "2. Encuentra tecnicos cerca",
    text: "Te mostramos tecnicos disponibles en tu zona."
  },
  {
    title: "3. Agenda una visita",
    text: "Elige horario y confirma el servicio."
  },
  {
    title: "4. Trabajo realizado",
    text: "El tecnico realiza el trabajo y puedes calificarlo."
  }
];

const trustItems = ["Tecnicos verificados", "Calificaciones de clientes", "Pago seguro", "Soporte al cliente"];

export default function HomePage() {
  return (
    <main className="page market-shell mvp-landing">
      <section className="home-top mvp-top">
        <MarketNav />

        <section className="panel mvp-hero" id="inicio">
          <p className="mvp-kicker">MVP WeTask Chile</p>
          <h1>Encuentra tecnicos confiables a domicilio en minutos</h1>
          <p className="lead">Gasfiter, electricistas y maestros cerca de ti. Agenda en linea y recibe ayuda hoy mismo.</p>

          <div className="cta-row mvp-hero-actions">
            <Link href="/solicitar-tecnico?source=hero_primary" className="cta">
              Buscar tecnico
            </Link>
            <Link href="/trabaja-con-nosotros?source=hero_secondary" className="cta ghost">
              Ofrecer servicios
            </Link>
          </div>

          <p className="mvp-coverage-note">
            Disponible actualmente en: Las Condes, Vitacura, Providencia, Nunoa y Lo Barnechea.
          </p>
        </section>
      </section>

      <section className="panel mvp-section" id="servicios">
        <div className="panel-head">
          <h2>Servicios disponibles</h2>
        </div>
        <div className="mvp-service-grid">
          {landingServices.map((service) => (
            <article key={service.key} className="mvp-service-card">
              <span className="mvp-service-icon" aria-hidden>
                {service.icon}
              </span>
              <h3>{service.label}</h3>
              <Link href={`/solicitar-tecnico?servicio=${encodeURIComponent(service.label)}&source=service_${service.key}`} className="cta small">
                Ver tecnicos
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mvp-section" id="como-funciona">
        <div className="panel-head">
          <h2>Como funciona</h2>
        </div>
        <div className="mvp-steps-grid">
          {howItWorks.map((step) => (
            <article key={step.title} className="mvp-step-card">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mvp-section" id="confianza">
        <div className="panel-head">
          <h2>Tecnicos verificados y servicio seguro</h2>
        </div>
        <ul className="mvp-trust-list">
          {trustItems.map((item) => (
            <li key={item}>✔ {item}</li>
          ))}
        </ul>
      </section>

      <section className="panel mvp-final-cta" id="cta-final">
        <h2>¿Necesitas ayuda en casa?</h2>
        <p>Encuentra un tecnico confiable en minutos.</p>
        <Link href="/solicitar-tecnico?source=final_cta" className="cta">
          Buscar tecnico ahora
        </Link>
      </section>

      <footer className="panel mvp-footer" id="footer">
        <Link href="/sobre-nosotros">Sobre nosotros</Link>
        <a href="#como-funciona">Como funciona</a>
        <Link href="/trabaja-con-nosotros">Convertirse en tecnico</Link>
        <Link href="/sobre-nosotros">Contacto</Link>
        <Link href="/legal">Terminos y privacidad</Link>
      </footer>
    </main>
  );
}
