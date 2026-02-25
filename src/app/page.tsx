"use client";

import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

const homeCategories = [
  { emoji: "🏠", label: "Hogar", href: "/servicios/limpieza" },
  { emoji: "📚", label: "Clases", href: "/servicios/clases-colegio" },
  { emoji: "🧰", label: "Oficios", href: "/servicios/maestro-polifuncional" },
  { emoji: "⚡", label: "Electricidad", href: "/servicios/electricidad" },
  { emoji: "🎵", label: "Musica", href: "/servicios/clases-musica" },
  { emoji: "🧩", label: "Otros", href: "/servicios" }
];

export default function HomePage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="home-hero-shell">
        <div className="home-category-row">
          {homeCategories.map((category) => (
            <Link key={category.label} href={category.href} className="home-category-pill">
              <span aria-hidden>{category.emoji}</span>
              <span>{category.label}</span>
            </Link>
          ))}
        </div>

        <div className="panel minimal-main home-hero-main">
          <h1>Haz tu vida mas facil</h1>
          <p className="lead">Disfruta cualquier servicio en la comodidad de tu hogar.</p>
          <div className="cta-row minimal-main-actions">
            <Link href="/servicios" className="cta">
              Pedir servicio
            </Link>
            <Link href="/registro?role=PRO" className="cta">
              Ofrecer servicios
            </Link>
          </div>
          <p className="minimal-note">Santiago de Chile. Reserva por hora con precio claro.</p>
        </div>
      </section>

      <section className="panel minimal-info">
        <h2>Como funciona</h2>
        <p>
          WeTask conecta clientes con profesionales para servicios a domicilio en Chile. El objetivo es hacer que contratar y
          ofrecer servicios sea rapido, claro y confiable.
        </p>
        <p>
          El cliente busca y reserva en pocos pasos. El profesional define su zona, disponibilidad y tarifa para recibir
          solicitudes. Todo ocurre dentro de la plataforma para mantener seguimiento y orden operativo.
        </p>
      </section>

      <section className="panel home-links-panel">
        <div className="home-links">
          <Link href="/sobre-nosotros" className="home-link-item">
            Sobre nosotros
          </Link>
          <Link href="/empleo" className="home-link-item">
            Empleo
          </Link>
          <Link href="/legal" className="home-link-item">
            Legal
          </Link>
        </div>
      </section>
    </main>
  );
}
