"use client";

import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

export default function HomePage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel minimal-main">
        <p className="eyebrow">Wetask Chile</p>
        <h1>Servicios a domicilio, simple.</h1>
        <p className="lead">Elige si quieres pedir un servicio o trabajar como profesional.</p>
        <div className="cta-row minimal-main-actions">
          <Link href="/reservar" className="cta">
            Pedir servicio
          </Link>
          <Link href="/registro?role=PRO" className="cta ghost">
            Ofrecer servicios
          </Link>
        </div>
        <p className="minimal-note">Santiago de Chile. Reserva por hora con precio claro.</p>
      </section>
    </main>
  );
}
