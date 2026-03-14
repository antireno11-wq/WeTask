"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { CORE_SERVICES, type CoreTaskerServiceSlug } from "@/lib/core-services";

export default function TrabajaConNosotrosPage() {
  const [selectedService, setSelectedService] = useState<CoreTaskerServiceSlug>(CORE_SERVICES[0]?.slug ?? "limpieza");

  return (
    <main className="auth-flow-screen">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Trabaja con nosotros</p>
            <h1>Convierte tu experiencia en servicios reservables.</h1>
            <p>
              Elige tu especialidad y te llevamos al onboarding profesional con el mismo estilo visual de WeTask.
            </p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Activacion guiada</strong>
                <span>Completarás perfil, cobertura, documentos y condiciones para poder recibir reservas.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Pago protegido</strong>
                <span>Gestiona agenda, servicios y pagos desde una sola cuenta profesional.</span>
              </div>
            </div>

            <div className="auth-flow-inline-links">
              <Link href="/ingresar/tasker">Ya soy tasker</Link>
              <Link href="/legal">Condiciones de uso</Link>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide">
            <div className="panel-head auth-flow-panel-head">
              <h2>Elige tu servicio principal</h2>
              <p>Usaremos esta seleccion para personalizar tu onboarding profesional.</p>
            </div>

          <form action="/trabaja-con-nosotros/registro" method="GET" className="auth-service-form">
            <div className="auth-service-grid" role="radiogroup" aria-label="Servicios disponibles">
              {CORE_SERVICES.map((service) => {
                const isActive = selectedService === service.slug;
                return (
                  <label key={service.slug} className={`auth-service-card ${isActive ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="service"
                      value={service.slug}
                      checked={isActive}
                      onChange={() => setSelectedService(service.slug)}
                    />
                    <span className="auth-service-icon" aria-hidden>
                      {service.icon}
                    </span>
                    <strong>{service.label}</strong>
                    <span>{service.taskerDescription}</span>
                  </label>
                );
              })}
            </div>

            <div className="auth-flow-note-card">
              <strong>Servicio seleccionado</strong>
              <span>{CORE_SERVICES.find((service) => service.slug === selectedService)?.label ?? "Limpieza"}</span>
            </div>

            <div className="auth-flow-actions">
              <button type="submit" className="cta">
                Continuar onboarding
              </button>
              <Link href="/ingresar/tasker" className="cta ghost">
                Iniciar sesion
              </Link>
            </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
