import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

const topCategories = [
  { key: "hogar", icon: "🏠", label: "Hogar", service: "Limpieza general" },
  { key: "clases", icon: "📚", label: "Clases", service: "Clases particulares" },
  { key: "deportes", icon: "💪", label: "Deportes", service: "Entrenamiento" },
  { key: "otros", icon: "🧰", label: "Otros", service: "Maestro multiuso" },
  { key: "cuidados", icon: "❤️", label: "Cuidados", service: "Cuidado de personas" },
  { key: "belleza", icon: "💇", label: "Belleza", service: "Peluqueria" },
  { key: "mascotas", icon: "🐶", label: "Mascotas", service: "Cuidado de mascotas" }
];

const howItWorks = [
  {
    title: "Busca lo que necesitas",
    text: "Selecciona la categoria y cuentanos que servicio necesitas en tu domicilio."
  },
  {
    title: "Escoge a tu profesional",
    text: "Compara perfiles, precios por hora y disponibilidad antes de reservar."
  },
  {
    title: "Contratalo en pocos clics",
    text: "Reserva online y coordina todo desde WeTask con pago protegido."
  }
];

const whyWetask = [
  {
    title: "Precio",
    text: "Servicios al mejor precio."
  },
  {
    title: "Tranquilidad",
    text: "Profesionales de confianza. Soporte 365 dias del ano. Tu dinero protegido hasta el final."
  },
  {
    title: "Comodidad",
    text: "Recibe cualquier servicio sin tener que salir de casa."
  }
];

const guaranteeItems = [
  "Pago seguro",
  "Garantia de reembolso",
  "Atencion 365 dias del ano"
];

export default function HomePage() {
  return (
    <main className="page market-shell mvp-landing">
      <section className="home-top mvp-top">
        <MarketNav />

        <section className="panel mvp-hero" id="inicio">
          <div className="mvp-category-top-row" aria-label="Categorias principales">
            {topCategories.map((item) => (
              <Link
                key={item.key}
                href={`/solicitar-tecnico?servicio=${encodeURIComponent(item.service)}&source=home_category_${item.key}`}
                className="mvp-category-top-pill"
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <p className="mvp-kicker">WeTask Chile</p>
          <h1>Haz tu vida mas facil</h1>
          <p className="lead">Disfruta cualquier servicio en la comodidad de tu hogar.</p>

          <div className="cta-row mvp-hero-actions">
            <Link href="/solicitar-tecnico?source=hero_primary" className="cta">
              Buscar servicio
            </Link>
            <Link href="/registro?role=PRO&source=hero_secondary" className="cta ghost">
              Ofrecer servicios
            </Link>
          </div>
        </section>
      </section>

      <section className="panel mvp-section" id="como-funciona">
        <div className="panel-head">
          <h2>Como funciona</h2>
        </div>
        <div className="mvp-how-grid">
          {howItWorks.map((step) => (
            <article key={step.title} className="mvp-step-card">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mvp-section mvp-intro" id="sobre-nosotros-home">
        <div className="mvp-intro-copy">
          <h2>Pedimos de todo a casa: comida, paquetes, la compra… pero, ¿y los servicios?</h2>
          <p>
            Con WeTask puedes disfrutar de casi cualquier servicio (clases, belleza, fisioterapia y mas) sin tener que salir de casa.
          </p>
        </div>
      </section>

      <section className="panel mvp-section" id="por-que">
        <div className="panel-head">
          <h2>¿Por que WeTask?</h2>
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

      <section className="panel mvp-final-cta mvp-guarantee-final" id="garantia-wetask">
        <p className="mvp-kicker">Garantia WeTask</p>
        <h2>No te preocupes, tu servicio esta protegido</h2>
        <p>El profesional recibe el pago cuando confirmas que el servicio fue correcto.</p>
        <ul className="mvp-trust-list">
          {guaranteeItems.map((item) => (
            <li key={item}>✔ {item}</li>
          ))}
        </ul>
        <Link href="/solicitar-tecnico?source=garantia_cta" className="cta">
          Buscar tecnico ahora
        </Link>
      </section>

      <footer className="panel mvp-footer" id="footer">
        <Link href="/sobre-nosotros">Sobre nosotros</Link>
        <a href="#como-funciona">Como funciona</a>
        <Link href="/registro?role=PRO">Convertirse en tecnico</Link>
        <Link href="/sobre-nosotros">Contacto</Link>
        <Link href="/legal">Terminos y privacidad</Link>
      </footer>
    </main>
  );
}
