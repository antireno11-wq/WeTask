import Link from "next/link";
import { CleaningOnboardingStatus, PayoutStatus, TicketStatus, UserRole } from "@prisma/client";
import { AdminHeroShell } from "@/components/admin-hero-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const onboardingStatusLabel: Record<CleaningOnboardingStatus, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_REVISION: "Pendiente de revisión",
  REQUIERE_CORRECCION: "Requiere corrección",
  APROBADO: "Aprobado",
  ACTIVO: "Activo"
};

const onboardingStatusClass: Record<CleaningOnboardingStatus, string> = {
  BORRADOR: "status-pending",
  PENDIENTE_REVISION: "status-pending",
  REQUIERE_CORRECCION: "status-cancelled",
  APROBADO: "status-completed",
  ACTIVO: "status-accepted"
};

function bookingStatusLabel(status: string) {
  if (status === "COMPLETED") return "Completado";
  if (status === "IN_PROGRESS") return "En curso";
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "ACCEPTED") return "Aceptado";
  if (status === "ASSIGNED") return "Asignado";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "REFUNDED") return "Reembolsado";
  if (status === "PAYMENT_FAILED") return "Pago rechazado";
  if (status === "PENDING") return "Pendiente";
  return status.toLowerCase().replace(/_/g, " ");
}

function bookingStatusClass(status: string) {
  if (status === "COMPLETED") return "status-completed";
  if (status === "IN_PROGRESS") return "status-in-progress";
  if (status === "CONFIRMED") return "status-confirmed";
  if (status === "ACCEPTED" || status === "ASSIGNED") return "status-assigned";
  if (status === "CANCELLED") return "status-cancelled";
  if (status === "REFUNDED") return "status-refunded";
  if (status === "PAYMENT_FAILED") return "status-payment-failed";
  return "status-pending";
}

function money(value: number) {
  return `$${value.toLocaleString("es-CL")}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtc(year: number, month: number, day: number, timeZone: string) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function getDayRange(dayOffset: number, timeZone: string) {
  const now = new Date();
  const currentParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(now)
    .split("-")
    .map((value) => Number(value));

  const base = new Date(Date.UTC(currentParts[0], currentParts[1] - 1, currentParts[2]));
  base.setUTCDate(base.getUTCDate() + dayOffset);

  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const day = base.getUTCDate();

  return {
    start: zonedTimeToUtc(year, month, day, timeZone),
    end: zonedTimeToUtc(year, month, day + 1, timeZone)
  };
}

function roleDailyCopy(today: number, yesterday: number) {
  const delta = today - yesterday;
  const trend = delta > 0 ? "subiendo" : delta < 0 ? "bajando" : "estable";
  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
  return {
    trend,
    deltaLabel,
    detail: `Hoy ${today} · Ayer ${yesterday} · ${deltaLabel}`
  };
}

export default async function AdminPage() {
  const chileTimeZone = "America/Santiago";
  const todayRange = getDayRange(0, chileTimeZone);
  const yesterdayRange = getDayRange(-1, chileTimeZone);

  const [
    pendingReview,
    needsCorrection,
    approved,
    activePros,
    openDisputes,
    pendingPayouts,
    admins,
    taskersTotal,
    customersTotal,
    newTaskersToday,
    newTaskersYesterday,
    newCustomersToday,
    newCustomersYesterday,
    recentOnboarding,
    recentBookings
  ] =
    await Promise.all([
      prisma.cleaningOnboarding.count({ where: { status: CleaningOnboardingStatus.PENDIENTE_REVISION } }),
      prisma.cleaningOnboarding.count({ where: { status: CleaningOnboardingStatus.REQUIERE_CORRECCION } }),
      prisma.cleaningOnboarding.count({ where: { status: CleaningOnboardingStatus.APROBADO } }),
      prisma.professionalProfile.count({ where: { isVerified: true } }),
      prisma.disputeTicket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_REVIEW] } } }),
      prisma.payout.count({ where: { status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.user.count({
        where: {
          OR: [{ role: UserRole.PRO }, { roleAssignments: { some: { role: { code: UserRole.PRO } } } }]
        }
      }),
      prisma.user.count({
        where: {
          OR: [{ role: UserRole.CUSTOMER }, { roleAssignments: { some: { role: { code: UserRole.CUSTOMER } } } }]
        }
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: todayRange.start, lt: todayRange.end },
          OR: [{ role: UserRole.PRO }, { roleAssignments: { some: { role: { code: UserRole.PRO } } } }]
        }
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: yesterdayRange.start, lt: yesterdayRange.end },
          OR: [{ role: UserRole.PRO }, { roleAssignments: { some: { role: { code: UserRole.PRO } } } }]
        }
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: todayRange.start, lt: todayRange.end },
          OR: [{ role: UserRole.CUSTOMER }, { roleAssignments: { some: { role: { code: UserRole.CUSTOMER } } } }]
        }
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: yesterdayRange.start, lt: yesterdayRange.end },
          OR: [{ role: UserRole.CUSTOMER }, { roleAssignments: { some: { role: { code: UserRole.CUSTOMER } } } }]
        }
      }),
      prisma.cleaningOnboarding.findMany({
        where: {
          status: {
            in: [CleaningOnboardingStatus.PENDIENTE_REVISION, CleaningOnboardingStatus.REQUIERE_CORRECCION, CleaningOnboardingStatus.APROBADO]
          }
        },
        take: 5,
        orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
        include: {
          user: {
            select: {
              fullName: true,
              email: true
            }
          }
        }
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: [{ createdAt: "desc" }],
        include: {
          customer: { select: { fullName: true } },
          pro: { select: { fullName: true } },
          service: { select: { name: true } }
        }
      })
    ]);

  const taskerDaily = roleDailyCopy(newTaskersToday, newTaskersYesterday);
  const customerDaily = roleDailyCopy(newCustomersToday, newCustomersYesterday);

  return (
    <AdminHeroShell>
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Backoffice WeTask</span>
          <h2>Centro de operación interna</h2>
          <p>Valida profesionales, controla accesos del equipo y mantén pulso diario sobre reservas, payouts y casos abiertos.</p>
        </div>
        <Link href="/admin/team" className="cta admin-head-action">
          Gestionar equipo
        </Link>
      </div>

      <div className="module-grid admin-metrics-grid">
        <Link href="/admin/onboarding-limpieza?status=PENDIENTE_REVISION" className="module-card module-link admin-metric-card">
          <span className="metric-label">Pendientes de revisión</span>
          <strong>{pendingReview}</strong>
          <p>Perfiles listos para que tu equipo revise documentación y apruebe.</p>
        </Link>
        <Link href="/admin/onboarding-limpieza?status=REQUIERE_CORRECCION" className="module-card module-link admin-metric-card">
          <span className="metric-label">Correcciones solicitadas</span>
          <strong>{needsCorrection}</strong>
          <p>Taskers que deben completar o corregir su información.</p>
        </Link>
        <Link href="/admin/onboarding-limpieza?status=APROBADO" className="module-card module-link admin-metric-card">
          <span className="metric-label">Listos para activar</span>
          <strong>{approved}</strong>
          <p>Profesionales aprobados que ya pueden pasar a activos.</p>
        </Link>
        <Link href="/admin/onboarding-limpieza?status=ACTIVO" className="module-card module-link admin-metric-card">
          <span className="metric-label">Taskers activos</span>
          <strong>{activePros}</strong>
          <p>Perfiles verificados y operativos dentro de WeTask.</p>
        </Link>
        <article className="module-card admin-metric-card">
          <span className="metric-label">Disputas abiertas</span>
          <strong>{openDisputes}</strong>
          <p>Casos que todavía necesitan seguimiento del equipo.</p>
        </article>
        <article className="module-card admin-metric-card">
          <span className="metric-label">Payouts pendientes</span>
          <strong>{pendingPayouts}</strong>
          <p>Pagos a profesionales que aún no se han completado.</p>
        </article>
      </div>

      <div className="module-grid">
        <article className="module-card admin-metric-card">
          <span className="metric-label">Taskers en la plataforma</span>
          <strong>{taskersTotal}</strong>
          <p>Altas diarias de taskers en WeTask.</p>
          <span className="module-meta">
            {taskerDaily.detail} · {taskerDaily.trend}
          </span>
        </article>
        <article className="module-card admin-metric-card">
          <span className="metric-label">Clientes en la plataforma</span>
          <strong>{customersTotal}</strong>
          <p>Altas diarias de clientes registrados.</p>
          <span className="module-meta">
            {customerDaily.detail} · {customerDaily.trend}
          </span>
        </article>
      </div>

      <div className="module-grid">
        <Link href="/admin/onboarding-limpieza" className="module-card module-link">
          <h3>Validación de profesionales</h3>
          <p>Revisa onboarding, documentos, tarifas y activa perfiles manualmente.</p>
          <span className="module-meta">{pendingReview + needsCorrection + approved} casos en cola</span>
        </Link>

        <Link href="/admin/team" className="module-card module-link">
          <h3>Equipo interno</h3>
          <p>Controla qué correos tienen acceso privado al backoffice de WeTask.</p>
          <span className="module-meta">{admins} admin(s) con acceso</span>
        </Link>

        <Link href="/admin/team/new" className="module-card module-link">
          <h3>Crear otro administrador</h3>
          <p>Invita a otra persona del equipo para que también pueda revisar y aprobar usuarios.</p>
          <span className="module-meta">Acceso para aprobaciones</span>
        </Link>

        <Link href="/admin/users" className="module-card module-link">
          <h3>Usuarios de la plataforma</h3>
          <p>Revisa taskers y clientes por separado para seguir actividad y limpiar cuentas internas.</p>
          <span className="module-meta">{taskersTotal + customersTotal} cuenta(s) activas</span>
        </Link>
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Cola de validación</h3>
              <p>Los próximos perfiles que tu equipo debería revisar.</p>
            </div>
            <Link href="/admin/onboarding-limpieza" className="cta ghost small">
              Ver todo
            </Link>
          </div>

          <div className="admin-queue-list">
            {recentOnboarding.map((item) => (
              <article key={item.id} className="admin-queue-row">
                <div>
                  <h4>{item.user.fullName}</h4>
                  <p>{item.user.email}</p>
                  <p>
                    {item.categorySlug} · {item.baseCommune ?? "Sin comuna"} · Paso {item.currentStep}
                  </p>
                </div>
                <div className="cta-row">
                  <span className={`status ${onboardingStatusClass[item.status]}`}>{onboardingStatusLabel[item.status]}</span>
                  <Link href={`/admin/onboarding-limpieza/${item.id}`} className="cta ghost small">
                    Abrir ficha
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Actividad reciente</h3>
              <p>Reservas nuevas para tener pulso operativo de la plataforma.</p>
            </div>
          </div>

          <div className="admin-queue-list">
            {recentBookings.map((booking) => (
              <article key={booking.id} className="admin-queue-row">
                <div>
                  <h4>{booking.service.name}</h4>
                  <p>
                    Cliente: {booking.customer.fullName}
                    {booking.pro ? ` · Tasker: ${booking.pro.fullName}` : " · Sin tasker asignado"}
                  </p>
                  <p>
                    {booking.comuna} · {new Date(booking.scheduledAt).toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="admin-queue-meta">
                  <span className={`status ${bookingStatusClass(booking.status)}`}>{bookingStatusLabel(booking.status)}</span>
                  <strong>{money(booking.totalPriceClp)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminHeroShell>
  );
}
