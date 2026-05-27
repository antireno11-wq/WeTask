import Link from "next/link";
import { AuthHeroNav } from "@/components/auth-hero-nav";

export const metadata = {
  title: "Política de privacidad · WeTask",
  description: "Cómo WeTask trata y protege los datos personales en cumplimiento de la Ley 19.628 de Chile."
};

export default function PoliticaPrivacidadPage() {
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Privacidad</p>
            <h1>Política de privacidad y tratamiento de datos personales.</h1>
            <p>
              Esta política explica qué datos personales recopila WeTask, con qué fines los usamos, con quién los compartimos y
              cuáles son tus derechos como titular bajo la <strong>Ley 19.628</strong> sobre protección de la vida privada de Chile.
              Versión vigente: 1.0 — última actualización: mayo 2026.
            </p>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide minimal-info">
            <h2>1. Quién es el responsable del tratamiento</h2>
            <p>
              WeTask (en adelante, &ldquo;la Plataforma&rdquo;) es responsable del tratamiento de los datos personales recopilados a
              través de la app web. Para ejercer derechos, escríbenos a <a href="mailto:privacidad@wetask.cl">privacidad@wetask.cl</a>.
            </p>

            <h2>2. Qué datos personales recopilamos</h2>
            <ul>
              <li>
                <strong>Identificación y contacto:</strong> nombre completo, correo electrónico, teléfono, fecha de nacimiento.
              </li>
              <li>
                <strong>Cuenta de profesional:</strong> RUT, foto de identidad, comprobante de antecedentes, foto de perfil, datos bancarios.
              </li>
              <li>
                <strong>Ubicación:</strong> direcciones registradas, comuna de cobertura, y geolocalización del check-in del profesional al momento del servicio.
              </li>
              <li>
                <strong>Pago:</strong> últimos 4 dígitos de la tarjeta, marca, mes y año de vencimiento. <em>No almacenamos el número completo.</em> El procesamiento real lo realiza Mercado Pago.
              </li>
              <li>
                <strong>Reservas y comunicaciones:</strong> historial de reservas, mensajes de chat, reseñas y notificaciones dentro de la plataforma.
              </li>
              <li>
                <strong>Técnicos:</strong> dirección IP, identificadores de sesión y métricas básicas de uso para detectar abuso y prevenir fraude.
              </li>
            </ul>

            <h2>3. Para qué los usamos</h2>
            <ul>
              <li>Crear y administrar tu cuenta.</li>
              <li>Coordinar reservas entre clientes y profesionales.</li>
              <li>Procesar pagos y emitir boleta electrónica conforme a la normativa del SII.</li>
              <li>Enviar notificaciones operacionales por correo electrónico (recordatorios, confirmaciones, reseñas).</li>
              <li>Mejorar el servicio, prevenir fraudes y resolver disputas.</li>
            </ul>

            <h2>4. Con quién compartimos tus datos</h2>
            <ul>
              <li>
                <strong>Mercado Pago:</strong> para procesar pagos y liberar los fondos al profesional asignado.
              </li>
              <li>
                <strong>OpenFactura (Haulmer):</strong> para emitir la boleta electrónica en cumplimiento de la Ley 21.131.
              </li>
              <li>
                <strong>Resend:</strong> para enviar correos transaccionales.
              </li>
              <li>
                <strong>Twilio:</strong> para enviar códigos SMS de verificación.
              </li>
              <li>
                <strong>Cloudflare R2:</strong> para almacenar documentos del onboarding (identidad, antecedentes, foto de perfil) cifrados en tránsito y en reposo.
              </li>
              <li>
                <strong>Profesional asignado a tu reserva:</strong> recibe tu nombre, dirección y teléfono solo una vez confirmada la reserva.
              </li>
              <li>
                <strong>Autoridades:</strong> ante un requerimiento legal válido emitido por un tribunal o autoridad chilena competente.
              </li>
            </ul>
            <p>No vendemos ni cedemos tus datos personales a terceros para fines publicitarios.</p>

            <h2>5. Cuánto tiempo guardamos tus datos</h2>
            <ul>
              <li>
                <strong>Datos de cuenta:</strong> mientras la cuenta esté activa. Tras solicitar baja, mantenemos los datos por 30 días en estado &ldquo;eliminada&rdquo; (período de gracia) y luego se borran de manera definitiva.
              </li>
              <li>
                <strong>Datos contables (boletas, pagos):</strong> 6 años, según las obligaciones tributarias chilenas.
              </li>
              <li>
                <strong>Mensajes de chat:</strong> hasta 18 meses tras cerrarse la reserva, para resolución de disputas.
              </li>
            </ul>

            <h2>6. Tus derechos como titular (ARCO)</h2>
            <p>Conforme a la Ley 19.628, tienes derecho a:</p>
            <ul>
              <li>
                <strong>Acceso:</strong> obtener una copia de tus datos. Disponible en <Link href="/cliente">tu panel</Link> o por solicitud directa.
              </li>
              <li>
                <strong>Rectificación:</strong> corregir datos inexactos desde tu perfil.
              </li>
              <li>
                <strong>Cancelación (eliminación):</strong> eliminar tu cuenta. Inicia el proceso desde tu perfil o escribiendo a <a href="mailto:privacidad@wetask.cl">privacidad@wetask.cl</a>.
              </li>
              <li>
                <strong>Oposición:</strong> rechazar el uso de tus datos para fines no esenciales.
              </li>
            </ul>
            <p>
              Responderemos cualquier solicitud en un plazo máximo de 15 días hábiles. Si no obtienes respuesta satisfactoria, puedes
              presentar un reclamo ante la <strong>SUBTEL</strong> o el organismo regulador competente.
            </p>

            <h2>7. Seguridad</h2>
            <p>
              Aplicamos cifrado en tránsito (TLS 1.2+), hashing de contraseñas con bcrypt, separación de datos sensibles en
              proveedores especializados (Mercado Pago para tarjetas, Cloudflare R2 para documentos), y registros de auditoría
              internos para acciones administrativas.
            </p>

            <h2>8. Cookies y tecnologías similares</h2>
            <p>
              Usamos cookies estrictamente necesarias para mantener tu sesión iniciada (<code>wetask_session</code>, httpOnly,
              firmada con HMAC) y para flujos de onboarding (verificación de teléfono). No usamos cookies de seguimiento publicitario
              de terceros.
            </p>

            <h2>9. Cambios a esta política</h2>
            <p>
              Si modificamos esta política te avisaremos por correo electrónico al menos 15 días antes de que entren en vigor los
              cambios sustanciales.
            </p>

            <h2>10. Contacto</h2>
            <p>
              Consultas, ejercicio de derechos o reclamos: <a href="mailto:privacidad@wetask.cl">privacidad@wetask.cl</a>.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
