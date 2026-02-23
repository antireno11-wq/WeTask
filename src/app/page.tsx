"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

const featuredServices = [
  {
    name: "Limpieza",
    href: "/reservar?service=limpieza",
    tone: "cyan",
    price: "Desde $12.000/h",
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Maestro a domicilio",
    href: "/reservar?service=maestro",
    tone: "blue",
    price: "Desde $15.000/h",
    image:
      "https://images.unsplash.com/photo-1581147036324-c1c7f2c3f6d7?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Electricidad",
    href: "/reservar?service=electricidad",
    tone: "orange",
    price: "Desde $18.000/h",
    image:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Fontaneria",
    href: "/reservar?service=fontaneria",
    tone: "cyan",
    price: "Desde $17.000/h",
    image:
      "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Pintura",
    href: "/reservar?service=pintura",
    tone: "blue",
    price: "Desde $14.000/h",
    image:
      "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Jardineria",
    href: "/reservar?service=jardineria",
    tone: "orange",
    price: "Desde $13.000/h",
    image:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Clases de colegio",
    href: "/reservar?service=clases",
    tone: "cyan",
    price: "Desde $11.000/h",
    image:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Clases de musica",
    href: "/reservar?service=musica",
    tone: "orange",
    price: "Desde $13.500/h",
    image:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80"
  }
];

export default function HomePage() {
  const [search, setSearch] = useState("");
  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return featuredServices;
    return featuredServices.filter((item) => item.name.toLowerCase().includes(term));
  }, [search]);

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="hero-block">
        <div>
          <p className="eyebrow">Marketplace de servicios</p>
          <h1>No lo dejes para manana. Reserva un servicio fijo en minutos.</h1>
          <p className="lead">
            Santiago de Chile. Precio por hora definido, agenda visible y pago en plataforma.
          </p>

          <div className="home-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Que servicio necesitas hoy?"
              aria-label="Buscar servicio"
            />
            <Link href={search.trim() ? `/catalogo?q=${encodeURIComponent(search.trim())}` : "/catalogo"} className="cta">
              Buscar
            </Link>
          </div>

          <div className="cta-row">
            <Link href="/reservar" className="cta">
              Reservar ahora
            </Link>
            <Link href="/catalogo" className="cta ghost">
              Ver catalogo
            </Link>
            <Link href="/registro?role=PRO" className="cta ghost">
              Inscribirme como Tasker
            </Link>
            <Link href="/registro?role=CUSTOMER" className="cta ghost">
              Inscribirme como Cliente
            </Link>
          </div>

          <div className="stat-grid">
            <article className="stat-card">
              <strong>+20.000</strong>
              <span>clientes atendidos</span>
            </article>
            <article className="stat-card">
              <strong>15 min</strong>
              <span>tiempo promedio de asignacion</span>
            </article>
            <article className="stat-card">
              <strong>4.8/5</strong>
              <span>rating promedio</span>
            </article>
          </div>
        </div>

        <aside className="trust-card">
          <h2>Como funciona</h2>
          <ul>
            <li>Selecciona un servicio con tarifa fija por hora</li>
            <li>Elige dia, bloque y profesional disponible</li>
            <li>Paga y sigue tu reserva en tiempo real</li>
          </ul>
          <div className="home-role-grid">
            <Link href="/registro?role=PRO" className="role-card">
              <strong>Quiero ser Tasker</strong>
              <span>Activa tu perfil y recibe reservas.</span>
            </Link>
            <Link href="/registro?role=CUSTOMER" className="role-card">
              <strong>Quiero ser Cliente</strong>
              <span>Reserva servicios y paga seguro.</span>
            </Link>
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Servicios fijos</h2>
          <p>Sin cotizacion manual. El precio por hora ya esta definido.</p>
        </div>
        <div className="home-service-grid fixed">
          {filteredServices.map((service) => (
            <Link key={service.name} className={`home-service-card ${service.tone}`} href={service.href}>
              <span className="service-photo" style={{ backgroundImage: `url('${service.image}')` }} aria-hidden />
              <span>{service.name}</span>
              <small>{service.price}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Proceso simple</h2>
        </div>
        <div className="module-grid">
          <article className="module-card">
            <h3>1. Elige servicio</h3>
            <p>Selecciona categoria y revisa profesionales disponibles.</p>
          </article>
          <article className="module-card">
            <h3>2. Elige horario</h3>
            <p>Haz click en un bloque del calendario.</p>
          </article>
          <article className="module-card">
            <h3>3. Confirma pago</h3>
            <p>La reserva queda confirmada y el slot bloqueado.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
