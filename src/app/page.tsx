import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

const featuredServices = [
  { name: "Limpieza", href: "/catalogo?q=limpieza", icon: "🧼", tone: "cyan" },
  { name: "Maestro a domicilio", href: "/catalogo?q=maestro", icon: "🛠️", tone: "blue" },
  { name: "Electricidad", href: "/catalogo?q=electricidad", icon: "💡", tone: "orange" },
  { name: "Fontaneria", href: "/catalogo?q=fontaneria", icon: "🚰", tone: "cyan" },
  { name: "Pintura", href: "/catalogo?q=pintura", icon: "🎨", tone: "blue" },
  { name: "Jardineria", href: "/catalogo?q=jardineria", icon: "🌿", tone: "orange" },
  { name: "Clases de colegio", href: "/catalogo?q=clases", icon: "📘", tone: "cyan" },
  { name: "Clases de musica", href: "/catalogo?q=musica", icon: "🎵", tone: "orange" }
];

export default function HomePage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="hero-block">
        <div>
          <p className="eyebrow">Marketplace de servicios</p>
          <h1>Reserva por hora, elige profesional y paga en la plataforma.</h1>
          <p className="lead">
            Santiago de Chile. Disponibilidad real por calendario y confirmacion inmediata.
          </p>
          <div className="cta-row">
            <Link href="/reservar" className="cta">
              Reservar ahora
            </Link>
            <Link href="/catalogo" className="cta ghost">
              Ver catalogo
            </Link>
          </div>
        </div>

        <aside className="trust-card">
          <h2>Como funciona</h2>
          <ul>
            <li>Selecciona servicio y profesional o autoasignacion</li>
            <li>Elige fecha, horas, extras y confirma pago</li>
            <li>Sigue estado, chatea, califica y cierra servicio</li>
          </ul>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Servicios destacados</h2>
        </div>
        <div className="home-service-grid">
          {featuredServices.map((service) => (
            <Link key={service.name} className={`home-service-card ${service.tone}`} href={service.href}>
              <span className="service-emoji" aria-hidden>
                {service.icon}
              </span>
              <span>{service.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Modulos MVP incluidos</h2>
        </div>
        <div className="module-grid">
          <Link href="/cliente" className="module-card module-link">
            <h3>Cliente</h3>
            <p>Reservas, tracking, chat, reseña y soporte.</p>
          </Link>
          <Link href="/pro" className="module-card module-link">
            <h3>Profesional</h3>
            <p>Agenda, estados de servicio, ingresos y payout.</p>
          </Link>
          <Link href="/admin" className="module-card module-link">
            <h3>Admin</h3>
            <p>Reglas por categoria, disputas, comisiones y operaciones.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
