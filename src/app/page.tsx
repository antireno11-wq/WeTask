"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

const homeCategories = [
  { emoji: "🧹", label: "Limpieza", href: "/services/limpieza" },
  { emoji: "🧰", label: "Maestro", href: "/services/maestro-polifuncional" },
  { emoji: "⚡", label: "Electricidad", href: "/services/electricidad" },
  { emoji: "📚", label: "Clases colegio", href: "/services/clases-colegio" },
  { emoji: "🎵", label: "Clases musica", href: "/services/clases-musica" },
  { emoji: "🌿", label: "Jardineria", href: "/services/jardineria" },
  { emoji: "👶", label: "Baby sitter", href: "/services/baby-sitter" },
  { emoji: "💇", label: "Peluqueria", href: "/services/peluqueria" },
  { emoji: "💅", label: "Manicure", href: "/services/manicure" },
  { emoji: "🐾", label: "Veterinario", href: "/services/veterinario" },
  { emoji: "🐕", label: "Paseadores de perro", href: "/services/paseadores-de-perro" },
  { emoji: "🦴", label: "Cuidadores de animales", href: "/services/cuidadores-de-animales" }
];

export default function HomePage() {
  const router = useRouter();
  const [servicePath, setServicePath] = useState("/services");
  const [addressQuery, setAddressQuery] = useState("");

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (servicePath && servicePath !== "/services") {
      router.push(servicePath);
      return;
    }

    const params = new URLSearchParams();
    if (addressQuery.trim()) params.set("city", addressQuery.trim());
    router.push(`/services${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <main className="page market-shell">
      <section className="home-top">
        <MarketNav />

        <section className="home-hero-shell">
          <form className="home-search-bar" onSubmit={search}>
            <select value={servicePath} onChange={(event) => setServicePath(event.target.value)} aria-label="Servicio">
              <option value="/services">Servicio</option>
              <option value="/services/limpieza">Limpieza</option>
              <option value="/services/maestro-polifuncional">Maestro (polifuncional)</option>
              <option value="/services/electricidad">Electricidad</option>
              <option value="/services/clases-colegio">Clases de colegio</option>
              <option value="/services/clases-musica">Clases de musica</option>
              <option value="/services/jardineria">Jardineria</option>
              <option value="/services/baby-sitter">Baby sitter</option>
              <option value="/services/peluqueria">Peluqueria</option>
              <option value="/services/manicure">Manicure</option>
              <option value="/services/veterinario">Veterinario</option>
              <option value="/services/paseadores-de-perro">Paseadores de perro</option>
              <option value="/services/cuidadores-de-animales">Cuidadores de animales</option>
            </select>
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
              <Link href="/services" className="cta">
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

      <section className="panel home-footer-panel">
        <div className="home-footer-grid">
          <article className="home-footer-col">
            <h3>WeTask Chile</h3>
            <p>
              WeTask nace para hacer tu vida mas facil, conectandote con profesionales verificados para servicios a
              domicilio.
            </p>
          </article>

          <article className="home-footer-col">
            <h3>Sobre nosotros</h3>
            <div className="home-footer-links">
              <Link href="/sobre-nosotros" className="home-link-item">
                Contacta con nosotros
              </Link>
            </div>
            <h3>Empleo</h3>
            <div className="home-footer-links">
              <Link href="/registro?role=PRO" className="home-link-item">
                Ofrece tus servicios como profesional
              </Link>
              <Link href="/empleo" className="home-link-item">
                Trabaja en nuestro equipo
              </Link>
            </div>
          </article>

          <article className="home-footer-col">
            <h3>Legal</h3>
            <div className="home-footer-links">
              <Link href="/legal" className="home-link-item">
                Terminos y condiciones
              </Link>
              <Link href="/legal" className="home-link-item">
                Politica de privacidad
              </Link>
              <Link href="/legal" className="home-link-item">
                Politica de cookies
              </Link>
              <Link href="/legal" className="home-link-item">
                Politica de cancelacion
              </Link>
              <Link href="/legal" className="home-link-item">
                Aviso legal
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
