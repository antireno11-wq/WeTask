import Link from "next/link";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { CORE_SERVICES } from "@/lib/core-services";

const howItWorksSteps = [
  {
    title: "1. Eliges un servicio",
    image: "/services/1.png",
    text: "Seleccionas la categoría que necesitas y escribes tu dirección."
  },
  {
    title: "2. Comparas profesionales",
    image: "/services/2.png",
    text: "Ves perfiles, valoraciones, precios y disponibilidad real."
  },
  {
    title: "3. Reservas en línea",
    image: "/services/3.png",
    text: "Confirmas fecha y hora con pago protegido hasta terminar el servicio."
  },
  {
    title: "4. Evalúas el resultado",
    image: "/services/4.png",
    text: "Calificas al profesional y ayudas a mantener la calidad de la plataforma."
  }
];

export default function ComoFuncionaPage() {
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Como funciona</p>
            <h1>Desde la búsqueda hasta la reserva, todo pasa en pocos pasos.</h1>
            <p>WeTask conecta a personas que necesitan ayuda en casa con profesionales confiables cerca de ti.</p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Experiencia guiada</strong>
                <span>Eliges categoría, ingresas tu dirección y comparas opciones antes de pagar.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Pago protegido</strong>
                <span>Tu dinero queda resguardado hasta que el servicio se completa correctamente.</span>
              </div>
            </div>

            <div className="auth-flow-actions">
              <Link href="/services" className="cta">
                Ver servicios
              </Link>
              <Link href="/solicitar-tecnico" className="cta ghost">
                Buscar profesionales
              </Link>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide">
            <div className="panel-head auth-flow-panel-head">
              <h2>Resumen del proceso</h2>
              <p>Así se vive WeTask de punta a punta.</p>
            </div>
            <div className="we-info-grid">
              {howItWorksSteps.map((step) => (
                <article key={step.title} className="we-step-card">
                  <div className="we-step-photo" style={{ backgroundImage: `url(${step.image})` }} aria-hidden />
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>

      <div className="page home-auth-sections">
        <section className="panel">
          <div className="panel-head">
            <h2>Servicios activos</h2>
            <p>Estos son todos los servicios activos en la etapa inicial de WeTask.</p>
          </div>
          <div className="services-showcase-grid">
            {CORE_SERVICES.map((service) => (
              <Link key={service.slug} href={`/services/${service.categorySlug}`} className="services-showcase-card">
                <div className="services-showcase-media" style={{ backgroundImage: `url(${service.image})` }} aria-hidden />
                <div className="services-showcase-copy">
                  <strong>
                    {service.icon} {service.label}
                  </strong>
                  <span>{service.taskerDescription}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
