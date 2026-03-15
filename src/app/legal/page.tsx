import { AuthHeroNav } from "@/components/auth-hero-nav";

export default function LegalPage() {
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Legal</p>
            <h1>Transparencia y resguardo para usuarios y profesionales.</h1>
            <p>Aquí reuniremos los términos, condiciones, política de privacidad y reglas generales de uso de WeTask.</p>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide minimal-info">
            <h2>Términos y condiciones</h2>
            <p>
              WeTask opera como una plataforma de conexión y gestión segura entre clientes y profesionales. El uso de la plataforma
              implica respetar las reglas de reserva, pago, comunicación y cumplimiento establecidas por WeTask.
            </p>

            <h3>Coordinación dentro de la plataforma</h3>
            <p>
              Está prohibido coordinar servicios fuera de la plataforma. Clientes y profesionales deben mantener la reserva, el pago
              y la comunicación del servicio dentro de WeTask mientras la solicitud esté activa.
            </p>
            <p>
              Los profesionales que intenten desviar reservas, pagos o coordinación fuera de la plataforma podrán ser suspendidos o
              eliminados de WeTask, además de perder acceso a futuras solicitudes y beneficios internos.
            </p>

            <h3>Beneficios por usar la app</h3>
            <p>
              La reputación dentro de WeTask se construye con el uso real de la plataforma. Los profesionales con mejores reseñas y
              mejor desempeño pueden acceder a beneficios como:
            </p>
            <ul>
              <li>más visibilidad dentro de los resultados</li>
              <li>más oportunidades de trabajo y reservas</li>
              <li>insignias o destacadas premium dentro de la app</li>
            </ul>
            <p>
              Si un profesional trabaja por fuera de WeTask, pierde trazabilidad, reputación y posicionamiento dentro de la
              plataforma, por lo que ese servicio no suma al ranking ni a sus beneficios.
            </p>

            <h3>Consultas</h3>
            <p>Para consultas legales o de datos personales, escríbenos a legal@wetask.cl.</p>
          </section>
        </section>
      </div>
    </main>
  );
}
