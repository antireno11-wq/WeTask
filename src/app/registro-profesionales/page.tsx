import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

const benefits = [
  "Recibe solicitudes de clientes reales en tu zona",
  "Gestiona tu agenda y servicios desde un solo lugar",
  "Aumenta tu reputacion con reseñas verificadas"
];

const requiredDocuments = [
  "Cedula de identidad (frontal)",
  "Selfie sosteniendo la cedula",
  "Certificado de antecedentes",
  "Portafolio (3 a 6 fotos de trabajos)"
];

const processSteps = [
  {
    title: "1. Completa tu perfil",
    text: "Ingresa tus datos, especialidades y experiencia profesional."
  },
  {
    title: "2. Sube tus documentos",
    text: "Validamos identidad y antecedentes para proteger a los clientes."
  },
  {
    title: "3. Revision y activacion",
    text: "Nuestro equipo revisa tu solicitud y te notificamos por email."
  }
];

export default function RegistroProfesionalesLandingPage() {
  return (
    <main className="page market-shell mvp-landing">
      <MarketNav />

      <section className="panel mvp-hero">
        <p className="mvp-kicker">Registro Tasker WeTask</p>
        <h1>Gana dinero ofreciendo tus servicios tecnicos</h1>
        <p className="lead">Comparte esta pagina con profesionales para que se registren y comiencen a recibir trabajos en WeTask.</p>

        <div className="cta-row mvp-hero-actions">
          <Link href="/trabaja-con-nosotros/registro?source=landing_profesionales" className="cta">
            Comenzar registro
          </Link>
          <Link href="/ingresar/tasker" className="cta ghost">
            Ya tengo cuenta
          </Link>
        </div>

        <p className="minimal-note">
          Link para compartir: <strong>/registro-profesionales</strong>
        </p>
      </section>

      <section className="panel mvp-section">
        <div className="panel-head">
          <h2>Por que registrarte</h2>
        </div>
        <div className="module-grid">
          {benefits.map((item) => (
            <article key={item} className="module-card">
              <h3>✔ Beneficio</h3>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mvp-section">
        <div className="panel-head">
          <h2>Documentacion obligatoria</h2>
          <p>Este filtro nos ayuda a mantener una red de tecnicos confiables.</p>
        </div>
        <ul className="mvp-trust-list">
          {requiredDocuments.map((item) => (
            <li key={item}>✔ {item}</li>
          ))}
        </ul>
      </section>

      <section className="panel mvp-section">
        <div className="panel-head">
          <h2>Como funciona el alta</h2>
        </div>
        <div className="mvp-steps-grid">
          {processSteps.map((step) => (
            <article key={step.title} className="mvp-step-card">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mvp-final-cta">
        <h2>Listo para sumarte como tecnico?</h2>
        <p>Completa tu registro ahora y comienza el proceso de verificacion.</p>
        <Link href="/trabaja-con-nosotros/registro?source=landing_profesionales_final" className="cta">
          Registrarme ahora
        </Link>
      </section>
    </main>
  );
}
