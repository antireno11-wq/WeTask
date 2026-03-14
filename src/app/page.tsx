import Link from "next/link";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { activeCommunesSummaryWithConjunction } from "@/lib/communes";
import { CORE_SERVICES } from "@/lib/core-services";

const howItWorks = [
  {
    title: "Busca lo que necesitas",
    text: "Elige una categoría, agrega dirección y horario para ver cobertura real.",
    visual: "collage-one"
  },
  {
    title: "Escoge a tu profesional ideal",
    text: "Compara perfiles, precios por hora y disponibilidad antes de reservar.",
    visual: "collage-two"
  },
  {
    title: "Contrátalo en 1 click",
    text: "Reserva online y coordina todo desde WeTask con pago protegido.",
    visual: "collage-three"
  }
];

const whyWetask = [
  {
    title: "Precio",
    text: "Servicios al mejor precio. Transparencia desde el inicio."
  },
  {
    title: "Tranquilidad",
    text: "Profesionales de confianza, soporte 365 días del año y dinero protegido hasta el final."
  },
  {
    title: "Comodidad",
    text: "Recibe cualquier servicio sin tener que salir de casa."
  }
];

export default function HomePage() {
  return (
    <main className="home-auth-page">
      <div className="auth-flow-backdrop home-auth-backdrop" aria-hidden />

      <div className="login-screen-content home-auth-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide home-auth-hero" id="inicio">
          <div className="auth-flow-copy home-auth-copy">
            <p className="auth-flow-kicker">Marketplace WeTask</p>
            <h1>Haz tu vida más fácil con servicios a domicilio confiables.</h1>
            <p>Reserva ayuda real para tu casa, rutina o bienestar con pago protegido y cobertura activa en Santiago.</p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Disponible ahora</strong>
                <span>{activeCommunesSummaryWithConjunction()}</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Flujo simple</strong>
                <span>Busca, compara y reserva profesionales verificados desde una sola plataforma.</span>
              </div>
            </div>

            <div className="auth-flow-actions">
              <Link href="/solicitar-tecnico?source=hero_primary" className="cta">
                Buscar servicio
              </Link>
              <Link href="/trabaja-con-nosotros" className="cta ghost">
                Ofrecer servicios
              </Link>
            </div>
          </div>

          <section className="auth-flow-panel home-auth-panel">
            <div className="mvp-category-top-row" aria-label="Categorías principales">
              {CORE_SERVICES.map((item) => (
                <Link
                  key={item.slug}
                  href={`/services/${item.categorySlug}?source=home_category_${item.slug}`}
                  className="mvp-category-top-pill"
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mvp-hero-scene" aria-hidden>
              <picture>
                <source srcSet="/hero-webel-twofloor.webp" type="image/webp" />
                <img src="/hero-webel-reference.webp" alt="" />
              </picture>
            </div>
          </section>
        </section>
      </div>

      <div className="page home-auth-sections mvp-landing">
      <section className="panel mvp-section how-works" id="como-funciona">
        <div className="panel-head">
          <h2>¿Cómo funciona?</h2>
        </div>
        <div className="how-works-grid">
          {howItWorks.map((step) => (
            <article key={step.title} className="how-works-step">
              <div className={`how-works-visual ${step.visual}`} aria-hidden />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mvp-section mvp-service-showcase" id="servicios-disponibles">
        <div className="panel-head">
          <h2>Servicios que ya puedes reservar</h2>
          <p>Partimos con las categorías de mayor demanda para validar WeTask en Chile.</p>
        </div>

        <div className="mvp-service-gallery">
          {CORE_SERVICES.map((service) => (
            <Link key={service.slug} href={`/services/${service.categorySlug}`} className="mvp-service-media-card">
              <div className="mvp-service-media" style={{ backgroundImage: `url("${service.image}")` }} aria-hidden />
              <div className="mvp-service-copy">
                <strong>
                  {service.icon} {service.label}
                </strong>
                <span>{service.taskerDescription}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel mvp-section" id="por-que">
        <div className="panel-head">
          <h2>¿Por qué WeTask?</h2>
        </div>
        <div className="mvp-why-grid">
          {whyWetask.map((item) => (
            <article key={item.title} className="mvp-why-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mvp-section home-guarantee-panel mvp-guarantee-final" id="garantia-wetask">
        <div className="home-guarantee-grid">
          <div className="home-guarantee-copy">
            <p className="home-guarantee-eyebrow">GARANTÍA WETASK</p>
            <h2>
              No te preocupes, tu servicio está <span>siempre protegido</span>
            </h2>
            <p>El profesional solo recibe el dinero cuando confirmas que todo fue según lo esperado.</p>
            <p>Si algo sale mal, te devolvemos el importe total del servicio.</p>
          </div>

          <div className="home-guarantee-visual" aria-hidden>
            <div className="home-guarantee-ring">
              <div className="home-guarantee-badge">100% PROTEGIDO</div>
            </div>

            <article className="home-guarantee-card card-top-left">
              <strong>Pago seguro</strong>
              <span>Tu dinero protegido hasta recibir el servicio.</span>
            </article>

            <article className="home-guarantee-card card-top-right">
              <strong>Garantía de reembolso</strong>
              <span>Si algo sale mal, te devolvemos el dinero.</span>
            </article>

            <article className="home-guarantee-card card-bottom">
              <strong>Atención 365 días</strong>
              <span>Soporte disponible para lo que necesites.</span>
            </article>
          </div>
        </div>
      </section>

      <footer className="panel mvp-footer" id="footer">
        <Link href="/como-funciona">¿Cómo funciona?</Link>
        <Link href="/como-funciona">¿Qué es WeTask?</Link>
        <Link href="/como-funciona">Servicios</Link>
        <Link href="/legal">Términos y privacidad</Link>
      </footer>
      </div>
    </main>
  );
}
