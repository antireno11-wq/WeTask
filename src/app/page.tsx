import Link from "next/link";
import { AuthHeroNav } from "@/components/auth-hero-nav";
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

        <section className="home-auth-hero" id="inicio">
          <section className="auth-flow-panel home-hero-strip">
            <div className="home-hero-intro">
              <p className="auth-flow-kicker home-hero-kicker">Marketplace WeTask</p>
              <h1>Servicios a domicilio confiables para tu rutina.</h1>
              <p>Reserva ayuda real para tu casa, bienestar o día a día con pago protegido y profesionales listos para atenderte.</p>
              <div className="auth-flow-actions">
                <Link href="/solicitar-tecnico?source=hero_primary" className="cta">
                  Buscar servicio
                </Link>
                <Link href="/trabaja-con-nosotros" className="cta ghost">
                  Ofrecer servicios
                </Link>
              </div>
            </div>

            <div className="home-hero-categories mvp-category-top-row" aria-label="Categorías principales">
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

      <footer className="panel home-footer-panel" id="footer">
        <div className="home-footer-social">
          <p>Síguenos. WeTask está cerca de ti:</p>
          <div className="home-footer-social-links" aria-label="Redes sociales de WeTask">
            <span className="home-footer-social-pill" aria-hidden>Fb</span>
            <span className="home-footer-social-pill" aria-hidden>X</span>
            <span className="home-footer-social-pill" aria-hidden>Ig</span>
            <span className="home-footer-social-pill" aria-hidden>Tk</span>
            <span className="home-footer-social-pill" aria-hidden>In</span>
          </div>
        </div>

        <div className="home-footer-grid">
          <div className="home-footer-col">
            <h3>Descubre</h3>
            <div className="home-footer-links">
              <Link href="/trabaja-con-nosotros" className="home-link-item">Trabaja con WeTask</Link>
              <Link href="/servicios" className="home-link-item">Servicios por categoría</Link>
              <Link href="/solicitar-tecnico" className="home-link-item">Servicios cerca de ti</Link>
              <Link href="/catalogo" className="home-link-item">Todos los servicios</Link>
              <Link href="/como-funciona" className="home-link-item">Cómo funciona</Link>
              <Link href="/profesionales" className="home-link-item">Profesionales</Link>
              <Link href="/legal" className="home-link-item">Ayuda y soporte</Link>
            </div>
          </div>

          <div className="home-footer-col">
            <h3>Empresa</h3>
            <div className="home-footer-links">
              <Link href="/como-funciona" className="home-link-item">Sobre WeTask</Link>
              <Link href="/empleo" className="home-link-item">Oportunidades</Link>
              <Link href="/registro" className="home-link-item">Crear cuenta</Link>
              <Link href="/ingresar" className="home-link-item">Acceder</Link>
              <Link href="/trabaja-con-nosotros/registro" className="home-link-item">Quiero ofrecer servicios</Link>
              <Link href="/legal" className="home-link-item">Términos y privacidad</Link>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </main>
  );
}
