"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

const homeCategories = [
  { emoji: "🧹", label: "Limpieza", href: "/services/limpieza", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=120&q=80" },
  { emoji: "🧰", label: "Maestro", href: "/services/maestro-polifuncional", image: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=120&q=80" },
  { emoji: "📚", label: "Clases", href: "/services/clases-colegio", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=120&q=80" }
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
              <option value="/services/clases-colegio">Clases</option>
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
                <span
                  className="home-category-thumb"
                  style={{ backgroundImage: `linear-gradient(180deg, rgba(8,44,66,0.08), rgba(8,44,66,0.08)), url(${category.image})` }}
                  aria-hidden
                />
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

      <section className="panel home-guarantee-panel">
        <div className="home-guarantee-grid">
          <article className="home-guarantee-copy">
            <p className="home-guarantee-eyebrow">GARANTIA WETASK</p>
            <h2>
              No te preocupes, tu servicio esta <span>siempre protegido</span>
            </h2>
            <p>El profesional solo recibira el dinero cuando confirmes que todo fue segun lo esperado.</p>
            <p>Si algo sale mal, te devolvemos el total del servicio.</p>
          </article>

          <article className="home-guarantee-visual" aria-hidden>
            <div className="home-guarantee-ring">
              <div className="home-guarantee-badge">100% PROTEGIDO</div>
            </div>
            <div className="home-guarantee-card card-top-left">
              <strong>Pago seguro</strong>
              <span>Tu dinero esta protegido hasta que recibas el servicio.</span>
            </div>
            <div className="home-guarantee-card card-top-right">
              <strong>Garantia de reembolso</strong>
              <span>Si algo sale mal, te devolvemos el dinero.</span>
            </div>
            <div className="home-guarantee-card card-bottom">
              <strong>Atencion 365 dias</strong>
              <span>Siempre disponibles para ayudarte cuando lo necesites.</span>
            </div>
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
