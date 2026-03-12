import { MarketNav } from "@/components/market-nav";
import { CORE_SERVICES } from "@/lib/core-services";

export default function TrabajaConNosotrosPage() {
  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Ofrecer servicios</h2>
          <p>Selecciona el servicio que ofreces para continuar con su onboarding correspondiente.</p>
        </div>

        <form action="/trabaja-con-nosotros/registro" method="GET" className="grid-form">
          <label className="full">
            Servicio
            <select name="service" required defaultValue="">
              <option value="" disabled>
                Selecciona un servicio
              </option>
              {CORE_SERVICES.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.icon} {service.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="cta">
            Continuar
          </button>
        </form>
      </section>
    </main>
  );
}
