import Link from "next/link";
import { MarketNav } from "@/components/market-nav";
import { CORE_SERVICES } from "@/lib/core-services";

const howItWorksSteps = [
  {
    title: "1. Eliges un servicio",
    image: "/services/limpieza-opt.jpg",
    text: "Seleccionas la categoría que necesitas y escribes tu dirección."
  },
  {
    title: "2. Comparas profesionales",
    image: "/services/profesor-particular-opt.jpg",
    text: "Ves perfiles, valoraciones, precios y disponibilidad real."
  },
  {
    title: "3. Reservas en línea",
    image: "/services/chef-opt.jpg",
    text: "Confirmas fecha y hora con pago protegido hasta terminar el servicio."
  },
  {
    title: "4. Evalúas el resultado",
    image: "/services/personal-trainer-opt.jpg",
    text: "Calificas al profesional y ayudas a mantener la calidad de la plataforma."
  }
];

export default function ComoFuncionaPage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>¿Cómo funciona WeTask?</h2>
          <p>WeTask conecta personas que necesitan ayuda en casa con profesionales listos para atender por hora.</p>
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

      <section className="panel">
        <div className="panel-head">
          <h2>Servicios activos</h2>
          <p>Estos son todos los servicios activos en la etapa inicial de WeTask.</p>
        </div>
        <div className="home-service-grid compact-service-grid">
          {CORE_SERVICES.map((service) => (
            <Link key={service.slug} href={`/services/${service.categorySlug}`} className="home-service-card module-link">
              <div className="service-photo" style={{ backgroundImage: `url(${service.image})` }} aria-hidden />
              <h3>
                {service.icon} {service.label}
              </h3>
              <p>{service.taskerDescription}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
