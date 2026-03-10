import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

export default function TrabajaConNosotrosPage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel mvp-hero">
        <p className="mvp-kicker">Registro de tecnicos</p>
        <h1>Gana dinero ofreciendo tus servicios</h1>
        <p className="lead">Conecta con clientes en tu zona y recibe solicitudes de trabajo.</p>

        <div className="cta-row mvp-hero-actions">
          <Link href="/trabaja-con-nosotros/registro" className="cta">
            Comenzar registro
          </Link>
          <Link href="/ingresar/tasker" className="cta ghost">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Documentacion obligatoria</h2>
          <p>Para proteger a clientes y tecnicos, revisamos identidad y antecedentes.</p>
        </div>
        <ul className="mvp-trust-list">
          <li>✔ Cedula de identidad (frontal)</li>
          <li>✔ Selfie sosteniendo la cedula</li>
          <li>✔ Certificado de antecedentes</li>
          <li>✔ Portafolio de trabajos</li>
        </ul>
      </section>
    </main>
  );
}
