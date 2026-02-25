"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

const homeCategories = [
  { emoji: "🏠", label: "Hogar", href: "/servicios/limpieza" },
  { emoji: "📚", label: "Clases", href: "/servicios/clases-colegio" },
  { emoji: "🧰", label: "Oficios", href: "/servicios/maestro-polifuncional" },
  { emoji: "🌿", label: "Jardineria", href: "/servicios" },
  { emoji: "👶", label: "Baby sitter", href: "/servicios" },
  { emoji: "💇", label: "Peluqueria", href: "/servicios" },
  { emoji: "💅", label: "Manicure", href: "/servicios" },
  { emoji: "🐾", label: "Veterinario", href: "/servicios" },
  { emoji: "🐕", label: "Paseadores de perro", href: "/servicios" },
  { emoji: "🦴", label: "Cuidadores de animales", href: "/servicios" },
  { emoji: "⚡", label: "Electricidad", href: "/servicios/electricidad" },
  { emoji: "🎵", label: "Musica", href: "/servicios/clases-musica" },
  { emoji: "🧩", label: "Otros", href: "/servicios" }
];

export default function HomePage() {
  const router = useRouter();
  const [serviceQuery, setServiceQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");

  const search = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (serviceQuery.trim()) params.set("q", serviceQuery.trim());
    if (addressQuery.trim()) params.set("city", addressQuery.trim());
    router.push(`/profesionales${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <main className="page market-shell">
      <section className="home-top">
        <MarketNav />

        <section className="home-hero-shell">
          <form className="home-search-bar" onSubmit={search}>
            <input
              value={serviceQuery}
              onChange={(event) => setServiceQuery(event.target.value)}
              placeholder="Servicio"
              aria-label="Servicio"
            />
            <input
              value={addressQuery}
              onChange={(event) => setAddressQuery(event.target.value)}
              placeholder="Direccion o comuna"
              aria-label="Direccion o comuna"
            />
            <button type="submit" className="cta">
              Buscar
            </button>
          </form>

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
      </section>

      <section className="panel minimal-info how-works">
        <h2>¿Como funciona?</h2>
        <div className="how-works-grid">
          <article className="how-works-step">
            <div className="how-works-visual collage-one" aria-hidden />
            <h3>Busca lo que necesitas</h3>
            <p>Tenemos servicios para hogar, clases, oficios y mas categorias en un solo lugar.</p>
          </article>

          <article className="how-works-step">
            <div className="how-works-visual collage-two" aria-hidden />
            <h3>Escoge a tu profesional ideal</h3>
            <p>Compara perfiles, disponibilidad y calificaciones para elegir el mejor match.</p>
          </article>

          <article className="how-works-step">
            <div className="how-works-visual collage-three" aria-hidden />
            <h3>Contratalo en 1 click</h3>
            <p>Reserva y paga en plataforma con seguimiento de tu servicio de principio a fin.</p>
          </article>
        </div>
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
