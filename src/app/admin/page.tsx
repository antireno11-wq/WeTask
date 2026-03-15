import Link from "next/link";
import { CleaningOnboardingStatus, PayoutStatus, TicketStatus, UserRole } from "@prisma/client";
import { MarketNav } from "@/components/market-nav";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function money(value: number) {
  return `$${value.toLocaleString("es-CL")}`;
}

export default async function AdminPage() {
  const [pendingReview, needsCorrection, approved, activePros, openDisputes, pendingPayouts, admins, recentOnboarding, recentBookings] =
    await Promise.all([
      prisma.cleaningOnboarding.count({ where: { status: CleaningOnboardingStatus.PENDIENTE_REVISION } }),
      prisma.cleaningOnboarding.count({ where: { status: CleaningOnboardingStatus.REQUIERE_CORRECCION } }),
      prisma.cleaningOnboarding.count({ where: { status: CleaningOnboardingStatus.APROBADO } }),
      prisma.professionalProfile.count({ where: { isVerified: true } }),
      prisma.disputeTicket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_REVIEW] } } }),
      prisma.payout.count({ where: { status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
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

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel admin-page-shell">
        <div className="panel-head admin-page-head">
          <div>
            <span className="eyebrow">Backoffice privado</span>
            <h2>Backoffice WeTask</h2>
            <p>Centro interno para validar profesionales, coordinar al equipo y monitorear la operación de la plataforma.</p>
          </div>
          <Link href="/admin/team" className="cta">
            Gestionar equipo
          </Link>
        </div>

        <div className="module-grid admin-metrics-grid">
          <article className="module-card admin-metric-card">
            <span className="metric-label">Pendientes de revisión</span>
            <strong>{pendingReview}</strong>
            <p>Perfiles listos para que tu equipo revise documentación y apruebe.</p>
          </article>
          <article className="module-card admin-metric-card">
            <span className="metric-label">Correcciones solicitadas</span>
            <strong>{needsCorrection}</strong>
            <p>Taskers que deben completar o corregir su información.</p>
          </article>
          <article className="module-card admin-metric-card">
            <span className="metric-label">Listos para activar</span>
            <strong>{approved}</strong>
            <p>Profesionales aprobados que ya pueden pasar a activos.</p>
          </article>
          <article className="module-card admin-metric-card">
            <span className="metric-label">Taskers activos</span>
            <strong>{activePros}</strong>
            <p>Perfiles verificados y operativos dentro de WeTask.</p>
          </article>
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

          <Link href="/admin/technicians" className="module-card module-link">
            <h3>Técnicos legacy</h3>
            <p>Mantén visible el flujo antiguo mientras migras todo al onboarding nuevo.</p>
            <span className="module-meta">Panel legado</span>
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
                    <span className={`status status-${item.status.toLowerCase().replace(/_/g, "-")}`}>{item.status.toLowerCase().replace(/_/g, " ")}</span>
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
                    <span className={`status status-${booking.status.toLowerCase().replace(/_/g, "-")}`}>{booking.status.toLowerCase().replace(/_/g, " ")}</span>
                    <strong>{money(booking.totalPriceClp)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
