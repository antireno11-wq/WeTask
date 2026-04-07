import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeroShell } from "@/components/admin-hero-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("es-CL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
}

function dateTimeLabel(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("es-CL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
}

function money(value: number | null | undefined) {
  if (value == null) return "-";
  return `$${value.toLocaleString("es-CL")}`;
}

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

function roleLabel(code: "CUSTOMER" | "PRO" | "ADMIN") {
  if (code === "ADMIN") return "Admin";
  if (code === "PRO") return "Tasker";
  return "Cliente";
}

type PageProps = {
  params: {
    userId: string;
  };
};

export default async function AdminUserDetailPage({ params }: PageProps) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      authProvider: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      roleAssignments: {
        select: {
          role: {
            select: {
              code: true,
              label: true
            }
          }
        }
      },
      addresses: {
        orderBy: [{ updatedAt: "desc" }],
        take: 3,
        select: {
          id: true,
          label: true,
          street: true,
          city: true,
          postalCode: true,
          region: true,
          country: true,
          updatedAt: true
        }
      },
      professionalProfile: {
        select: {
          avatarUrl: true,
          bio: true,
          isVerified: true,
          verificationStatus: true,
          coverageStreet: true,
          coverageComuna: true,
          coverageCity: true,
          serviceRadiusKm: true,
          hourlyRateFromClp: true,
          ratingAvg: true,
          ratingsCount: true,
          updatedAt: true,
          taskerServices: {
            where: { isActive: true },
            orderBy: [{ updatedAt: "desc" }],
            select: {
              priceClp: true,
              minBooking: true,
              service: {
                select: {
                  name: true
                }
              },
              category: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      },
      cleaningOnboarding: {
        select: {
          status: true,
          categorySlug: true,
          baseCommune: true,
          referenceAddress: true,
          serviceCommunes: true,
          submittedAt: true,
          adminReviewNotes: true,
          updatedAt: true
        }
      },
      bookings: {
        orderBy: [{ createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          status: true,
          totalPriceClp: true,
          scheduledAt: true,
          createdAt: true,
          service: {
            select: {
              name: true
            }
          },
          pro: {
            select: {
              fullName: true
            }
          }
        }
      },
      proBookings: {
        orderBy: [{ createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          status: true,
          totalPriceClp: true,
          scheduledAt: true,
          createdAt: true,
          service: {
            select: {
              name: true
            }
          },
          customer: {
            select: {
              fullName: true
            }
          }
        }
      },
      notifications: {
        orderBy: [{ createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          isRead: true,
          createdAt: true
        }
      }
    }
  });

  if (!user) notFound();

  const roleAssignments =
    user.roleAssignments.length > 0
      ? user.roleAssignments.map((assignment) => assignment.role.label)
      : [roleLabel(user.role)];

  return (
    <AdminHeroShell>
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Backoffice WeTask</span>
          <h2>{user.fullName}</h2>
          <p>Ficha interna del usuario para revisar cuenta, actividad, reservas y perfil tasker si existe.</p>
        </div>
        <div className="cta-row">
          <Link href="/admin/users" className="cta ghost small">
            Volver a usuarios
          </Link>
        </div>
      </div>

      <section className="admin-section-card">
        <div className="admin-kv-grid">
          <div>
            <strong>Correo</strong>
            <span>{user.email}</span>
          </div>
          <div>
            <strong>Teléfono</strong>
            <span>{user.phone || "Sin teléfono guardado"}</span>
          </div>
          <div>
            <strong>Roles</strong>
            <span>{roleAssignments.join(", ")}</span>
          </div>
          <div>
            <strong>Proveedor acceso</strong>
            <span>{user.authProvider}</span>
          </div>
          <div>
            <strong>Correo verificado</strong>
            <span>{user.emailVerifiedAt ? dateTimeLabel(user.emailVerifiedAt) : "No verificado"}</span>
          </div>
          <div>
            <strong>Creado</strong>
            <span>{dateTimeLabel(user.createdAt)}</span>
          </div>
        </div>
      </section>

      {user.professionalProfile ? (
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Perfil tasker</h3>
              <p>Estado del perfil profesional publicado dentro de WeTask.</p>
            </div>
            <span className={`status ${user.professionalProfile.isVerified ? "status-approved" : "status-pending"}`}>
              {user.professionalProfile.isVerified ? "Verificado" : "Pendiente"}
            </span>
          </div>

          <div className="admin-kv-grid">
            <div>
              <strong>Estado</strong>
              <span>{user.professionalProfile.verificationStatus}</span>
            </div>
            <div>
              <strong>Tarifa desde</strong>
              <span>{money(user.professionalProfile.hourlyRateFromClp)}</span>
            </div>
            <div>
              <strong>Rating</strong>
              <span>{Number(user.professionalProfile.ratingAvg).toFixed(1)} ({user.professionalProfile.ratingsCount} reseñas)</span>
            </div>
            <div>
              <strong>Cobertura</strong>
              <span>
                {[user.professionalProfile.coverageStreet, user.professionalProfile.coverageComuna, user.professionalProfile.coverageCity]
                  .filter(Boolean)
                  .join(", ") || "Sin cobertura guardada"}
              </span>
            </div>
          </div>

          {user.professionalProfile.bio ? (
            <div className="admin-note-block">
              <strong>Bio</strong>
              <p>{user.professionalProfile.bio}</p>
            </div>
          ) : null}

          {user.professionalProfile.taskerServices.length > 0 ? (
            <div className="admin-doc-grid">
              {user.professionalProfile.taskerServices.map((item, index) => (
                <article key={`${item.service.name}-${index}`} className="admin-doc-card">
                  <div className="admin-doc-head">
                    <strong>{item.service.name}</strong>
                    <span className="status status-approved">{item.category.name}</span>
                  </div>
                  <p>{money(item.priceClp)} · mínimo {item.minBooking}h</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {user.cleaningOnboarding ? (
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Onboarding</h3>
              <p>Estado interno del onboarding tasker.</p>
            </div>
            <span className="status status-approved">{user.cleaningOnboarding.status}</span>
          </div>

          <div className="admin-kv-grid">
            <div>
              <strong>Categoría</strong>
              <span>{user.cleaningOnboarding.categorySlug}</span>
            </div>
            <div>
              <strong>Comuna base</strong>
              <span>{user.cleaningOnboarding.baseCommune || "Sin comuna base"}</span>
            </div>
            <div>
              <strong>Dirección referencia</strong>
              <span>{user.cleaningOnboarding.referenceAddress || "Sin dirección guardada"}</span>
            </div>
            <div>
              <strong>Enviado</strong>
              <span>{dateLabel(user.cleaningOnboarding.submittedAt)}</span>
            </div>
          </div>

          {Array.isArray(user.cleaningOnboarding.serviceCommunes) && user.cleaningOnboarding.serviceCommunes.length > 0 ? (
            <div className="admin-note-block">
              <strong>Comunas de trabajo</strong>
              <p>{user.cleaningOnboarding.serviceCommunes.filter((item): item is string => typeof item === "string").join(", ")}</p>
            </div>
          ) : null}

          {user.cleaningOnboarding.adminReviewNotes ? (
            <div className="admin-note-block">
              <strong>Notas admin</strong>
              <p>{user.cleaningOnboarding.adminReviewNotes}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {user.addresses.length > 0 ? (
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Direcciones</h3>
              <p>Últimas direcciones guardadas por el usuario.</p>
            </div>
          </div>
          <div className="admin-doc-grid">
            {user.addresses.map((address) => (
              <article key={address.id} className="admin-doc-card">
                <strong>{address.label || "Dirección"}</strong>
                <p>{[address.street, address.city, address.region, address.postalCode].filter(Boolean).join(", ")}</p>
                <span>Actualizada: {dateLabel(address.updatedAt)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="admin-users-grid">
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Reservas como cliente</h3>
              <p>Últimas reservas hechas por este usuario como cliente.</p>
            </div>
          </div>
          <div className="admin-team-list">
            {user.bookings.length > 0 ? (
              user.bookings.map((booking) => (
                <article key={booking.id} className="admin-team-row">
                  <div className="admin-team-row-copy">
                    <h4>{booking.service.name}</h4>
                    <p>{booking.pro?.fullName || "Sin tasker asignado"}</p>
                    <div className="admin-user-meta-row">
                      <span className="status status-approved">{bookingStatusLabel(booking.status)}</span>
                      <span className="admin-email-chip">{money(booking.totalPriceClp)}</span>
                    </div>
                  </div>
                  <div className="cta-row admin-team-row-actions">
                    <span>{dateTimeLabel(booking.scheduledAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty">No tiene reservas como cliente todavía.</p>
            )}
          </div>
        </section>

        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Reservas como tasker</h3>
              <p>Últimas reservas atendidas por este usuario como tasker.</p>
            </div>
          </div>
          <div className="admin-team-list">
            {user.proBookings.length > 0 ? (
              user.proBookings.map((booking) => (
                <article key={booking.id} className="admin-team-row">
                  <div className="admin-team-row-copy">
                    <h4>{booking.service.name}</h4>
                    <p>{booking.customer?.fullName || "Cliente sin nombre"}</p>
                    <div className="admin-user-meta-row">
                      <span className="status status-approved">{bookingStatusLabel(booking.status)}</span>
                      <span className="admin-email-chip">{money(booking.totalPriceClp)}</span>
                    </div>
                  </div>
                  <div className="cta-row admin-team-row-actions">
                    <span>{dateTimeLabel(booking.scheduledAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty">No tiene reservas como tasker todavía.</p>
            )}
          </div>
        </section>
      </div>

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Notificaciones recientes</h3>
            <p>Últimos avisos generados para esta cuenta.</p>
          </div>
        </div>
        <div className="admin-team-list">
          {user.notifications.length > 0 ? (
            user.notifications.map((notification) => (
              <article key={notification.id} className="admin-team-row">
                <div className="admin-team-row-copy">
                  <h4>{notification.title}</h4>
                  <p>{notification.body}</p>
                </div>
                <div className="cta-row admin-team-row-actions">
                  <span className={`status ${notification.isRead ? "status-approved" : "status-pending"}`}>
                    {notification.isRead ? "Leída" : "No leída"}
                  </span>
                  <span>{dateTimeLabel(notification.createdAt)}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="empty">No hay notificaciones recientes para esta cuenta.</p>
          )}
        </div>
      </section>
    </AdminHeroShell>
  );
}
