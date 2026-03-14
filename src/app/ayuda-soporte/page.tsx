"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";

type HelpCard = {
  title: string;
  text: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type FaqSection = {
  title: string;
  items: FaqItem[];
};

type TicketStatus = "Solicitud recibida" | "En revisión" | "En proceso" | "Resuelta" | "Cerrada";

const quickHelpCards: HelpCard[] = [
  {
    title: "Reservas",
    text: "Resuelve dudas sobre agendamiento, cambios de fecha, cancelaciones y estado de tu servicio."
  },
  {
    title: "Pagos y reembolsos",
    text: "Consulta información sobre cobros, métodos de pago, devoluciones y comprobantes."
  },
  {
    title: "Cuenta cliente",
    text: "Administra tus datos personales, direcciones, métodos de pago y preferencias."
  },
  {
    title: "Cuenta profesional",
    text: "Encuentra ayuda sobre registro, aprobación de perfil, pagos, comisiones y disponibilidad."
  },
  {
    title: "Seguridad y confianza",
    text: "Conoce cómo protegemos a clientes y profesionales y cómo reportar situaciones inapropiadas."
  },
  {
    title: "Contactar soporte",
    text: "Si no encontraste tu respuesta, comunícate con nuestro equipo de ayuda."
  }
];

const faqSections: FaqSection[] = [
  {
    title: "Reservas",
    items: [
      {
        question: "¿Cómo reservo un servicio en WeTask?",
        answer:
          "Para reservar un servicio en WeTask debes ingresar a la categoría que necesitas, seleccionar el tipo de servicio, indicar la dirección donde se realizará, elegir fecha y horario disponibles, revisar el valor estimado y confirmar tu reserva con un método de pago válido."
      },
      {
        question: "¿Puedo reagendar una reserva?",
        answer:
          "Sí. Puedes reagendar una reserva desde tu cuenta, en la sección “Mis reservas”, siempre que el cambio se solicite dentro de los plazos permitidos por la política de cancelación o modificación vigente."
      },
      {
        question: "¿Puedo cancelar una reserva?",
        answer:
          "Sí. Puedes cancelar una reserva desde tu cuenta. Dependiendo del tiempo de anticipación con que canceles, puede aplicar un reembolso total, parcial o no corresponder reembolso, según la política vigente."
      },
      {
        question: "¿Qué pasa si el profesional no llega?",
        answer:
          "Si el profesional no se presenta dentro del tiempo razonable definido por WeTask, podrás reportar el problema desde tu reserva. Nuestro equipo revisará el caso y, si corresponde, gestionará una solución, reprogramación o devolución."
      },
      {
        question: "¿Cómo sé si mi reserva quedó confirmada?",
        answer:
          "Una vez que la reserva sea aceptada y el pago autorizado, recibirás una confirmación en la plataforma y, si corresponde, una notificación por correo o mensaje."
      },
      {
        question: "¿Puedo reservar para otra persona?",
        answer:
          "Sí. Puedes hacer una reserva para un familiar, amigo o tercero, siempre que ingreses correctamente la dirección, datos de contacto y detalles necesarios para la prestación del servicio."
      }
    ]
  },
  {
    title: "Pagos y reembolsos",
    items: [
      {
        question: "¿Qué métodos de pago acepta WeTask?",
        answer:
          "WeTask acepta los métodos de pago habilitados dentro de la plataforma, como tarjetas de débito, crédito u otros medios disponibles al momento de reservar."
      },
      {
        question: "¿Cuándo se realiza el cobro?",
        answer:
          "El cobro puede realizarse al momento de confirmar la reserva o según el flujo definido por la plataforma. El detalle exacto del cobro será mostrado antes de finalizar el pago."
      },
      {
        question: "¿Cómo funciona un reembolso?",
        answer:
          "Cuando corresponda un reembolso, WeTask procesará la devolución al mismo medio de pago utilizado, salvo que se indique otra modalidad. Los tiempos de reflejo del dinero pueden depender de la entidad bancaria o procesador de pagos."
      },
      {
        question: "¿Qué pasa si me cobraron y el servicio no se realizó?",
        answer:
          "Si el servicio no se realizó, debes reportarlo desde tu reserva o a través de soporte. El equipo revisará el caso y, si corresponde, gestionará la devolución o solución adecuada."
      },
      {
        question: "¿Puedo solicitar boleta o comprobante?",
        answer:
          "Sí. Una vez realizado el pago, podrás revisar el comprobante disponible en la plataforma o solicitar ayuda a soporte si necesitas asistencia adicional."
      }
    ]
  },
  {
    title: "Cuenta del cliente",
    items: [
      {
        question: "¿Cómo creo una cuenta en WeTask?",
        answer:
          "Puedes crear tu cuenta registrándote con los datos solicitados en la plataforma. Es importante ingresar información real y actualizada para facilitar la gestión de tus reservas y pagos."
      },
      {
        question: "¿Cómo cambio mis datos personales?",
        answer:
          "Puedes actualizar tus datos desde la sección “Mi cuenta” o “Perfil”, donde podrás editar información como nombre, teléfono, dirección y otros datos permitidos."
      },
      {
        question: "¿Puedo guardar más de una dirección?",
        answer:
          "Sí. Puedes guardar una o más direcciones para usar en futuras reservas, facilitando el proceso de agendamiento."
      },
      {
        question: "¿Cómo elimino mi cuenta?",
        answer:
          "Si deseas eliminar tu cuenta, puedes solicitarlo a través de soporte. La solicitud será revisada conforme a nuestras políticas de privacidad y tratamiento de datos."
      }
    ]
  },
  {
    title: "Cuenta del profesional",
    items: [
      {
        question: "¿Cómo me registro como profesional en WeTask?",
        answer:
          "Debes completar el formulario de registro, ingresar tus datos personales, comuna o comunas de cobertura, experiencia, disponibilidad, tarifas, datos bancarios y aceptar los términos y condiciones. Luego tu perfil será revisado antes de ser activado."
      },
      {
        question: "¿Qué necesito para que aprueben mi perfil?",
        answer:
          "Debes entregar información completa, verdadera y actualizada. WeTask puede solicitar antecedentes adicionales, validación de identidad, documentos de respaldo o revisión manual del perfil."
      },
      {
        question: "¿Cómo recibo mis pagos?",
        answer:
          "Los pagos se realizan a la cuenta bancaria registrada en tu perfil, de acuerdo con los plazos y condiciones definidos por WeTask."
      },
      {
        question: "¿WeTask cobra comisión?",
        answer:
          "Sí. WeTask puede cobrar una comisión por el uso de la plataforma y la intermediación del servicio. Esa comisión y sus condiciones serán informadas dentro de la plataforma o en los documentos legales correspondientes."
      },
      {
        question: "¿Cómo defino mi disponibilidad?",
        answer:
          "Puedes configurar tu disponibilidad en tu perfil profesional indicando días, horarios y zonas donde deseas prestar servicios."
      },
      {
        question: "¿Qué pasa si un cliente cancela?",
        answer:
          "Si un cliente cancela, la situación se resolverá conforme a la política de cancelación vigente. Dependiendo del plazo y condiciones, puede o no corresponder compensación."
      },
      {
        question: "¿Cómo consigo más reservas?",
        answer:
          "Tener un perfil completo, buenas reseñas, tiempos de respuesta rápidos, tarifas competitivas y una buena disponibilidad puede ayudarte a recibir más solicitudes."
      }
    ]
  },
  {
    title: "Seguridad y confianza",
    items: [
      {
        question: "¿WeTask verifica a los profesionales?",
        answer:
          "WeTask puede aplicar procesos de validación de identidad, revisión de antecedentes o controles internos según la categoría del servicio y las políticas vigentes de la plataforma."
      },
      {
        question: "¿Cómo reporto una mala experiencia?",
        answer:
          "Puedes reportar una mala experiencia desde la reserva realizada o a través de la sección “Reportar un problema”. Nuestro equipo evaluará el caso y tomará las medidas correspondientes."
      },
      {
        question: "¿Qué hago si tuve una situación inapropiada?",
        answer:
          "Si experimentaste una situación de riesgo, conducta inapropiada o incumplimiento grave, repórtalo de inmediato mediante el formulario de incidentes o contacto de soporte. En casos urgentes, te recomendamos priorizar tu seguridad y contactar a las autoridades correspondientes si es necesario."
      },
      {
        question: "¿Mis datos personales están protegidos?",
        answer:
          "Sí. WeTask trata los datos personales conforme a su política de privacidad y las normas aplicables, utilizando medidas razonables para su protección."
      }
    ]
  }
];

const clientHelpBlocks: HelpCard[] = [
  {
    title: "Antes de reservar",
    text: "Revisa la descripción del servicio, la cobertura, la tarifa estimada y la disponibilidad antes de confirmar tu reserva."
  },
  {
    title: "Durante la reserva",
    text: "Asegúrate de ingresar correctamente la dirección, referencias y observaciones para facilitar la llegada y ejecución del servicio."
  },
  {
    title: "Después del servicio",
    text: "Podrás calificar tu experiencia, dejar una reseña y reportar cualquier inconveniente desde tu cuenta."
  },
  {
    title: "Problemas con una reserva",
    text: "Si tuviste un inconveniente con el profesional, un cobro o la ejecución del servicio, puedes reportarlo directamente a soporte."
  }
];

const proHelpBlocks: HelpCard[] = [
  {
    title: "Crear y completar perfil",
    text: "Mantén tu perfil actualizado con experiencia, tarifas, cobertura, disponibilidad, datos bancarios y fotografía profesional."
  },
  {
    title: "Gestión de reservas",
    text: "Revisa tus solicitudes, confirma disponibilidad y mantén una comunicación clara y oportuna con los clientes."
  },
  {
    title: "Pagos y comisiones",
    text: "Consulta cómo se procesan tus pagos, los plazos de abono y las comisiones aplicables por el uso de la plataforma."
  },
  {
    title: "Reputación y reseñas",
    text: "Las calificaciones de tus clientes influyen en tu visibilidad y confianza dentro de WeTask."
  },
  {
    title: "Normas de uso",
    text: "Todos los profesionales deben cumplir con los estándares de servicio, conducta, puntualidad y seguridad definidos por WeTask."
  }
];

const reportCategories = [
  "Tengo un problema con mi reserva",
  "El profesional no llegó",
  "El cliente no se presentó",
  "Tengo un problema con un cobro",
  "Quiero reportar una conducta inapropiada",
  "Quiero denunciar una mala experiencia",
  "Otro problema"
];

const supportChannels: HelpCard[] = [
  {
    title: "Chat de soporte",
    text: "Recibe ayuda directa desde la plataforma."
  },
  {
    title: "Correo electrónico",
    text: "Escríbenos para consultas, problemas o solicitudes especiales."
  },
  {
    title: "WhatsApp",
    text: "Contáctanos de forma rápida para recibir orientación y soporte."
  },
  {
    title: "Formulario de contacto",
    text: "Déjanos tu mensaje y te responderemos por correo o teléfono."
  }
];

const ticketStatuses: TicketStatus[] = ["Solicitud recibida", "En revisión", "En proceso", "Resuelta", "Cerrada"];

const sampleTickets = [
  {
    caseNumber: "WT-1024",
    createdAt: "12 Mar 2026",
    type: "Problema con reserva",
    status: "En revisión" as TicketStatus,
    updatedAt: "Hace 2 horas",
    response: "Estamos revisando la información de tu reserva y validando la asistencia del profesional."
  },
  {
    caseNumber: "WT-1018",
    createdAt: "10 Mar 2026",
    type: "Cobro duplicado",
    status: "En proceso" as TicketStatus,
    updatedAt: "Hoy",
    response: "Nuestro equipo de pagos confirmó la incidencia y está coordinando la reversa correspondiente."
  },
  {
    caseNumber: "WT-0993",
    createdAt: "06 Mar 2026",
    type: "Conducta inapropiada",
    status: "Resuelta" as TicketStatus,
    updatedAt: "Ayer",
    response: "El caso fue cerrado con medidas internas y confirmación enviada por correo."
  }
];

const policyLinks = [
  "Términos y condiciones",
  "Política de privacidad",
  "Política de cancelación",
  "Política de reembolsos",
  "Reglas para profesionales",
  "Tratamiento de datos personales"
];

export default function AyudaSoportePage() {
  const [search, setSearch] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [reportFileMessage, setReportFileMessage] = useState("");
  const [reportForm, setReportForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    userType: "Cliente",
    bookingId: "",
    category: reportCategories[0],
    description: "",
    accepted: false
  });
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    reason: "",
    message: ""
  });

  const filteredFaqSections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return faqSections;

    return faqSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.question.toLowerCase().includes(term) || item.answer.toLowerCase().includes(term)
        )
      }))
      .filter((section) => section.items.length > 0);
  }, [search]);

  const hasFaqResults = filteredFaqSections.some((section) => section.items.length > 0);

  const handleReportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportMessage("");

    if (
      !reportForm.fullName.trim() ||
      !reportForm.email.trim() ||
      !reportForm.phone.trim() ||
      !reportForm.description.trim() ||
      !reportForm.accepted
    ) {
      setReportMessage("Por favor completa todos los campos obligatorios antes de continuar.");
      return;
    }

    setReportMessage("Hemos recibido tu reporte. Nuestro equipo revisará la información y te contactará a la brevedad.");
    setReportForm({
      fullName: "",
      email: "",
      phone: "",
      userType: "Cliente",
      bookingId: "",
      category: reportCategories[0],
      description: "",
      accepted: false
    });
    setReportFileMessage("");
  };

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactMessage("");

    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.reason.trim() || !contactForm.message.trim()) {
      setContactMessage("Por favor completa todos los campos obligatorios antes de continuar.");
      return;
    }

    setContactMessage("Tu mensaje fue enviado correctamente. Te responderemos lo antes posible.");
    setContactForm({
      name: "",
      email: "",
      phone: "",
      reason: "",
      message: ""
    });
  };

  const handleEvidenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setReportFileMessage(file ? "Tu archivo fue adjuntado correctamente." : "");
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll support-page-shell">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Ayuda y soporte</p>
            <h1>Encuentra respuestas rápidas sobre reservas, pagos, cancelaciones, seguridad y uso de WeTask.</h1>
            <p>
              Si necesitas ayuda adicional, nuestro equipo de soporte está disponible para ayudarte con clientes, profesionales y
              cualquier inconveniente de la plataforma.
            </p>

            <div className="support-search-card">
              <label className="support-search-label" htmlFor="support-search">
                Buscador
              </label>
              <input
                id="support-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Busca tu pregunta o problema"
              />
            </div>

            <div className="auth-flow-actions support-hero-actions">
              <a href="#support-faq" className="cta">
                Ver preguntas frecuentes
              </a>
              <a href="#support-contact" className="cta ghost">
                Contactar soporte
              </a>
              <a href="#support-report" className="cta ghost">
                Reportar un problema
              </a>
              <a href="#support-policies" className="cta ghost">
                Ver términos y políticas
              </a>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide support-hero-panel">
            <div className="panel-head auth-flow-panel-head">
              <h2>Centro de ayuda WeTask</h2>
              <p>Todo lo esencial para resolver dudas rápido y seguir usando la plataforma con tranquilidad.</p>
            </div>

            <div className="support-hero-grid">
              <article className="support-hero-stat">
                <strong>Reservas y cambios</strong>
                <span>Reagenda, confirma estados y entiende los plazos de cancelación.</span>
              </article>
              <article className="support-hero-stat">
                <strong>Pagos y reembolsos</strong>
                <span>Consulta cobros, comprobantes y devoluciones desde un solo lugar.</span>
              </article>
              <article className="support-hero-stat">
                <strong>Clientes y profesionales</strong>
                <span>Guías separadas para cada tipo de usuario y sus procesos clave.</span>
              </article>
              <article className="support-hero-stat">
                <strong>Soporte humano</strong>
                <span>Si no encuentras respuesta, puedes escalar tu caso con reporte o contacto directo.</span>
              </article>
            </div>
          </section>
        </section>
      </div>

      <div className="page home-auth-sections support-page-content">
        <section className="panel" id="support-quick-help">
          <div className="panel-head">
            <h2>¿Cómo te podemos ayudar?</h2>
            <p>Elige una ruta rápida según el tipo de duda o problema que necesitas resolver.</p>
          </div>
          <div className="support-card-grid">
            {quickHelpCards.map((card) => (
              <article key={card.title} className="support-info-card">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" id="support-faq">
          <div className="panel-head">
            <h2>Preguntas frecuentes</h2>
            <p>Las preguntas aparecen cerradas por defecto. Haz click en cada una para ver la respuesta.</p>
          </div>

          {!hasFaqResults ? (
            <div className="support-empty-search">
              <strong>No encontramos resultados para tu búsqueda.</strong>
              <p>Prueba con otras palabras o contacta a soporte.</p>
            </div>
          ) : (
            <div className="support-faq-sections">
              {filteredFaqSections.map((section) => (
                <article key={section.title} className="support-faq-group">
                  <div className="support-section-head">
                    <h3>{section.title}</h3>
                    <span>{section.items.length} tema(s)</span>
                  </div>
                  <div className="we-faq-list support-faq-list">
                    {section.items.map((item) => (
                      <details key={item.question}>
                        <summary>{item.question}</summary>
                        <p>{item.answer}</p>
                      </details>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Ayuda para clientes</h2>
            <p>Si contrataste un servicio en WeTask, aquí encontrarás información útil para gestionar tus reservas, pagos y soporte.</p>
          </div>

          <div className="support-card-grid support-card-grid-four">
            {clientHelpBlocks.map((block) => (
              <article key={block.title} className="support-info-card">
                <h3>{block.title}</h3>
                <p>{block.text}</p>
              </article>
            ))}
          </div>

          <div className="auth-flow-actions support-section-actions">
            <Link href="/cliente" className="cta">
              Ver mis reservas
            </Link>
            <a href="#support-report" className="cta ghost">
              Reportar un problema
            </a>
            <a href="#support-contact" className="cta ghost">
              Contactar soporte
            </a>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Ayuda para profesionales</h2>
            <p>
              Si prestas servicios a través de WeTask, aquí encontrarás información sobre tu perfil, tus pagos, tus reservas y tus
              responsabilidades dentro de la plataforma.
            </p>
          </div>

          <div className="support-card-grid support-card-grid-five">
            {proHelpBlocks.map((block) => (
              <article key={block.title} className="support-info-card">
                <h3>{block.title}</h3>
                <p>{block.text}</p>
              </article>
            ))}
          </div>

          <div className="auth-flow-actions support-section-actions">
            <Link href="/pro" className="cta">
              Ver mi perfil
            </Link>
            <Link href="/pro" className="cta ghost">
              Revisar pagos
            </Link>
            <a href="#support-policies" className="cta ghost">
              Ver políticas para profesionales
            </a>
            <a href="#support-contact" className="cta ghost">
              Contactar soporte
            </a>
          </div>
        </section>

        <section className="panel support-form-panel" id="support-report">
          <div className="panel-head">
            <h2>Reportar un problema</h2>
            <p>Cuéntanos qué ocurrió y nuestro equipo revisará tu caso lo antes posible.</p>
          </div>

          <div className="support-report-options">
            {reportCategories.map((option) => (
              <button
                key={option}
                type="button"
                className={`support-report-chip ${reportForm.category === option ? "active" : ""}`}
                onClick={() => setReportForm((current) => ({ ...current, category: option }))}
              >
                {option}
              </button>
            ))}
          </div>

          <form className="grid-form support-form-grid" onSubmit={handleReportSubmit}>
            <label>
              Nombre completo
              <input
                value={reportForm.fullName}
                onChange={(event) => setReportForm((current) => ({ ...current, fullName: event.target.value }))}
                required
              />
            </label>
            <label>
              Correo electrónico
              <input
                type="email"
                value={reportForm.email}
                onChange={(event) => setReportForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label>
              Teléfono
              <input
                value={reportForm.phone}
                onChange={(event) => setReportForm((current) => ({ ...current, phone: event.target.value }))}
                required
              />
            </label>
            <label>
              Tipo de usuario
              <select
                value={reportForm.userType}
                onChange={(event) => setReportForm((current) => ({ ...current, userType: event.target.value }))}
              >
                <option value="Cliente">Cliente</option>
                <option value="Profesional">Profesional</option>
              </select>
            </label>
            <label>
              Número de reserva
              <input
                value={reportForm.bookingId}
                onChange={(event) => setReportForm((current) => ({ ...current, bookingId: event.target.value }))}
                placeholder="Ej: WT-45821"
              />
            </label>
            <label>
              Categoría del problema
              <select
                value={reportForm.category}
                onChange={(event) => setReportForm((current) => ({ ...current, category: event.target.value }))}
              >
                {reportCategories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Descripción del problema
              <textarea
                rows={6}
                value={reportForm.description}
                onChange={(event) => setReportForm((current) => ({ ...current, description: event.target.value }))}
                required
              />
            </label>
            <label className="full">
              Adjuntar evidencia
              <input type="file" onChange={handleEvidenceChange} />
              {reportFileMessage ? <p className="input-hint support-success-inline">{reportFileMessage}</p> : null}
            </label>
            <label className="full support-checkbox">
              <input
                type="checkbox"
                checked={reportForm.accepted}
                onChange={(event) => setReportForm((current) => ({ ...current, accepted: event.target.checked }))}
              />
              <span>Acepto que WeTask revise la información enviada para gestionar este caso.</span>
            </label>

            <div className="full auth-flow-actions support-section-actions">
              <button type="submit" className="cta">
                Enviar reporte
              </button>
            </div>
          </form>

          {reportMessage ? (
            <p className={`feedback ${reportMessage.includes("recibido") ? "ok" : "error"}`}>{reportMessage}</p>
          ) : null}
        </section>

        <section className="panel" id="support-contact">
          <div className="panel-head">
            <h2>Contacta a nuestro equipo</h2>
            <p>Si no encontraste la respuesta que buscabas, escríbenos y te ayudaremos.</p>
          </div>

          <div className="support-card-grid support-card-grid-four">
            {supportChannels.map((channel) => (
              <article key={channel.title} className="support-info-card support-channel-card">
                <h3>{channel.title}</h3>
                <p>{channel.text}</p>
              </article>
            ))}
          </div>

          <form className="grid-form support-form-grid support-contact-form" onSubmit={handleContactSubmit}>
            <label>
              Nombre
              <input
                value={contactForm.name}
                onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Correo electrónico
              <input
                type="email"
                value={contactForm.email}
                onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label>
              Teléfono
              <input value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label>
              Motivo de contacto
              <input
                value={contactForm.reason}
                onChange={(event) => setContactForm((current) => ({ ...current, reason: event.target.value }))}
                required
              />
            </label>
            <label className="full">
              Mensaje
              <textarea
                rows={5}
                value={contactForm.message}
                onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                required
              />
            </label>

            <div className="full auth-flow-actions support-section-actions">
              <button type="submit" className="cta">
                Enviar mensaje
              </button>
            </div>
          </form>

          {contactMessage ? (
            <p className={`feedback ${contactMessage.includes("correctamente") ? "ok" : "error"}`}>{contactMessage}</p>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Seguimiento de solicitudes</h2>
            <p>Revisa el estado de tus consultas, reportes o problemas informados a soporte.</p>
          </div>

          <div className="support-status-row">
            {ticketStatuses.map((status) => (
              <span key={status} className="support-status-chip">
                {status}
              </span>
            ))}
          </div>

          <div className="support-ticket-list">
            {sampleTickets.map((ticket) => (
              <article key={ticket.caseNumber} className="support-ticket-card">
                <div className="support-ticket-head">
                  <div>
                    <strong>{ticket.caseNumber}</strong>
                    <span>{ticket.type}</span>
                  </div>
                  <span className="support-ticket-status">{ticket.status}</span>
                </div>
                <div className="support-ticket-meta">
                  <p>
                    <strong>Fecha de creación:</strong> {ticket.createdAt}
                  </p>
                  <p>
                    <strong>Última actualización:</strong> {ticket.updatedAt}
                  </p>
                </div>
                <p className="support-ticket-response">{ticket.response}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" id="support-policies">
          <div className="panel-head">
            <h2>Términos y políticas</h2>
            <p>
              Te recomendamos revisar nuestras políticas para entender cómo funciona la plataforma, las condiciones de uso y el
              tratamiento de tu información.
            </p>
          </div>

          <div className="support-policy-grid">
            {policyLinks.map((item) => (
              <Link key={item} href="/legal" className="support-policy-link">
                {item}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
