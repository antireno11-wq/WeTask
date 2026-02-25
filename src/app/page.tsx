"use client";

import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

export default function HomePage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel minimal-main">
        <h1>Servicios a domicilio, simple.</h1>
        <p className="lead">Elige si quieres pedir un servicio o trabajar como profesional.</p>
        <div className="cta-row minimal-main-actions">
          <Link href="/reservar" className="cta">
            Pedir servicio
          </Link>
          <Link href="/registro?role=PRO" className="cta">
            Ofrecer servicios
          </Link>
        </div>
        <p className="minimal-note">Santiago de Chile. Reserva por hora con precio claro.</p>
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
    </main>
  );
}
