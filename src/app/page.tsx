import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

const categories = [
  "Limpieza",
  "Manitas",
  "Electricidad",
  "Fontaneria",
  "Pintura",
  "Jardineria",
  "Mudanzas ligeras",
  "Cuidado"
];

export default function HomePage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="hero-block">
        <div>
          <p className="eyebrow">Marketplace tipo Webel</p>
          <h1>Reserva servicios al hogar por hora, con precio fijo y pago en plataforma.</h1>
          <p className="lead">
            Flujo completo operativo: catalogo, profesional, reserva, pago, ejecucion, reseña y payout.
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
          <h2>Categorias destacadas</h2>
        </div>
        <div className="chips">
          {categories.map((category) => (
            <span key={category} className="chip">
              {category}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Modulos MVP incluidos</h2>
        </div>
        <div className="module-grid">
          <article className="module-card">
            <h3>Cliente</h3>
            <p>Reservas, tracking, chat, reseña y soporte.</p>
          </article>
          <article className="module-card">
            <h3>Profesional</h3>
            <p>Agenda, estados de servicio, ingresos y payout.</p>
          </article>
          <article className="module-card">
            <h3>Admin</h3>
            <p>Reglas por categoria, disputas, comisiones y operaciones.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
