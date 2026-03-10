"use client";

import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

export default function IngresarPage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Ingresar</h2>
          <p>Elige tu tipo de cuenta para continuar.</p>
        </div>

        <div className="login-split">
          <article className="module-card">
            <h3>Cliente</h3>
            <p>Para pedir servicios y gestionar tus reservas.</p>
            <Link href="/ingresar/cliente" className="cta small">
              Ingresar como cliente
            </Link>
            <Link href="/registro?role=CUSTOMER" className="cta ghost small">
              Crear cuenta cliente
            </Link>
          </article>

          <article className="module-card">
            <h3>Tasker (Profesional)</h3>
            <p>Para ofrecer servicios y administrar tu agenda.</p>
            <Link href="/ingresar/tasker" className="cta small">
              Ingresar como tasker
            </Link>
            <Link href="/trabaja-con-nosotros/registro" className="cta ghost small">
              Crear cuenta tasker
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
