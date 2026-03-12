import Link from "next/link";
import { MarketNav } from "@/components/market-nav";
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
    <main className="page market-shell mvp-landing">
      <section className="home-top mvp-top">
        <MarketNav />

        <section className="panel mvp-hero home-hero-main" id="inicio">
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

          <h1>Haz tu vida más fácil</h1>
          <p className="lead">Disfruta cualquier servicio en la comodidad de tu hogar.</p>

          <div className="cta-row mvp-hero-actions">
            <Link href="/solicitar-tecnico?source=hero_primary" className="cta">
              Buscar servicio
            </Link>
            <Link href="/trabaja-con-nosotros?source=hero_secondary" className="cta ghost">
              Ofrecer servicios
            </Link>
          </div>

          <div className="mvp-hero-scene" aria-hidden>
            <picture>
              <source srcSet="/hero-webel-twofloor.webp" type="image/webp" />
              <img src="/hero-webel-reference.webp" alt="" />
            </picture>
          </div>
        </section>
      </section>

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

      <section className="panel mvp-section mvp-intro" id="sobre-nosotros-home">
        <div className="mvp-intro-copy">
          <h2>Pedimos de todo a casa: comida, paquetes, la compra... pero, ¿y los servicios?</h2>
          <p>
            Con WeTask puedes disfrutar de casi cualquier servicio (clases, belleza, fisioterapia y más) sin tener que salir de casa.
          </p>
        </div>
        <div className="mvp-intro-visual-grid" aria-hidden>
          <div className="mvp-intro-visual main" />
          <div className="mvp-intro-visual secondary" />
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
        <Link href="/trabaja-con-nosotros">Convertirse en técnico</Link>
        <Link href="/como-funciona">Servicios</Link>
        <Link href="/legal">Términos y privacidad</Link>
      </footer>
    </main>
  );
}
