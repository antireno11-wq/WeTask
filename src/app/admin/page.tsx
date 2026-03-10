import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

export default function AdminPage() {
  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Panel admin</h2>
          <p>Selecciona el modulo que deseas revisar.</p>
        </div>

        <div className="module-grid">
          <Link href="/admin/onboarding-limpieza" className="module-card module-link">
            <h3>Onboarding Limpieza</h3>
            <p>Revision, aprobacion y activacion manual de profesionales de limpieza.</p>
          </Link>

          <Link href="/admin/technicians" className="module-card module-link">
            <h3>Tecnicos (legacy)</h3>
            <p>Panel existente de revision de tecnicos generales.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
