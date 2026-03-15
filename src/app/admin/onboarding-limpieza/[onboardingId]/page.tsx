import Link from "next/link";
import { notFound } from "next/navigation";
import { CleaningOnboardingStatus } from "@prisma/client";
import { MarketNav } from "@/components/market-nav";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabels: Record<CleaningOnboardingStatus, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_REVISION: "Pendiente de revisión",
  REQUIERE_CORRECCION: "Requiere corrección",
  APROBADO: "Aprobado",
  ACTIVO: "Activo"
};

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleString("es-CL");
}

function renderList(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "Sin información";
  return value.map((item) => String(item)).join(", ");
}

function isImagePreview(value: string) {
  return value.startsWith("data:image/") || /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(value);
}

function DocumentPreview({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return (
      <article className="admin-doc-card empty">
        <strong>{label}</strong>
        <p>Sin archivo cargado.</p>
      </article>
    );
  }

  return (
    <article className="admin-doc-card">
      <div className="admin-doc-head">
        <strong>{label}</strong>
        <a href={value} target="_blank" rel="noreferrer" className="cta ghost small">
          Abrir archivo
        </a>
      </div>
      {isImagePreview(value) ? <img src={value} alt={label} className="admin-doc-preview" /> : <p>Archivo cargado correctamente.</p>}
    </article>
  );
}

export default async function AdminCleaningOnboardingDetailPage({ params }: { params: { onboardingId: string } }) {
  const { onboardingId } = params;

  const onboarding = await prisma.cleaningOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          createdAt: true,
          professionalProfile: {
            select: {
              isVerified: true,
              verificationStatus: true,
              ratingAvg: true,
              ratingsCount: true
            }
          }
        }
      }
    }
  });

  if (!onboarding) notFound();

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel admin-page-shell">
        <div className="panel-head admin-page-head">
          <div>
            <span className="eyebrow">Validación interna</span>
            <h2>Ficha del profesional</h2>
            <p>Revisa identidad, cobertura, tarifas y documentación antes de aprobar o activar.</p>
          </div>
          <div className="cta-row">
            <span className={`status status-${statusLabels[onboarding.status].toLowerCase().replace(/\s+/g, "-")}`}>{statusLabels[onboarding.status]}</span>
            <Link href="/admin/onboarding-limpieza" className="cta ghost small">
              Volver a solicitudes
            </Link>
          </div>
        </div>

        <div className="admin-detail-grid">
          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>{onboarding.user.fullName}</h3>
                <p>{onboarding.user.email}</p>
              </div>
            </div>

            <div className="admin-kv-grid">
              <div>
                <strong>Teléfono</strong>
                <span>{onboarding.user.phone ?? "-"}</span>
              </div>
              <div>
                <strong>Categoría</strong>
                <span>{onboarding.categorySlug}</span>
              </div>
              <div>
                <strong>Dirección base</strong>
                <span>{onboarding.referenceAddress ?? "-"}</span>
              </div>
              <div>
                <strong>Comunas de cobertura</strong>
                <span>{renderList(onboarding.serviceCommunes)}</span>
              </div>
              <div>
                <strong>Tarifa por hora</strong>
                <span>{onboarding.hourlyRateClp ? `$${onboarding.hourlyRateClp.toLocaleString("es-CL")}` : "-"}</span>
              </div>
              <div>
                <strong>Mínimo por servicio</strong>
                <span>{onboarding.minBookingHours ? `${onboarding.minBookingHours} hora(s)` : "-"}</span>
              </div>
              <div>
                <strong>Modo de trabajo</strong>
                <span>{onboarding.workMode === "EQUIPO" ? "Con equipo" : onboarding.workMode === "SOLO" ? "Solo" : "-"}</span>
              </div>
              <div>
                <strong>Años de experiencia</strong>
                <span>{onboarding.yearsExperience ?? "-"}</span>
              </div>
              <div>
                <strong>Verificación de teléfono</strong>
                <span>{onboarding.phoneValidatedAt ? `Sí · ${formatDate(onboarding.phoneValidatedAt)}` : "Pendiente"}</span>
              </div>
              <div>
                <strong>Estado pro</strong>
                <span>{onboarding.user.professionalProfile?.verificationStatus ?? "Sin perfil aún"}</span>
              </div>
            </div>

            <div className="admin-note-block">
              <strong>Descripción</strong>
              <p>{onboarding.shortDescription ?? "Sin descripción cargada."}</p>
            </div>

            <div className="admin-note-block">
              <strong>Notas internas</strong>
              <p>{onboarding.adminReviewNotes ?? "Sin observaciones todavía."}</p>
            </div>
          </section>

          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>Resumen operativo</h3>
                <p>Fechas y datos clave para decidir si aprobar o pedir correcciones.</p>
              </div>
            </div>

            <div className="admin-kv-grid">
              <div>
                <strong>Paso actual</strong>
                <span>{onboarding.currentStep}</span>
              </div>
              <div>
                <strong>Creado</strong>
                <span>{formatDate(onboarding.createdAt)}</span>
              </div>
              <div>
                <strong>Enviado a revisión</strong>
                <span>{formatDate(onboarding.submittedAt)}</span>
              </div>
              <div>
                <strong>Revisado</strong>
                <span>{formatDate(onboarding.reviewedAt)}</span>
              </div>
              <div>
                <strong>Aprobado</strong>
                <span>{formatDate(onboarding.approvedAt)}</span>
              </div>
              <div>
                <strong>Activado</strong>
                <span>{formatDate(onboarding.activatedAt)}</span>
              </div>
              <div>
                <strong>Cuenta bancaria</strong>
                <span>
                  {onboarding.bankName ?? "-"} · {onboarding.bankAccountType ?? "-"}
                </span>
              </div>
              <div>
                <strong>Titular</strong>
                <span>{onboarding.bankAccountHolder ?? "-"}</span>
              </div>
              <div>
                <strong>RUT titular</strong>
                <span>{onboarding.bankAccountHolderRut ?? "-"}</span>
              </div>
              <div>
                <strong>Número de cuenta</strong>
                <span>{onboarding.bankAccountNumber ?? "-"}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Documentos para validación manual</h3>
              <p>Todo lo que tu equipo necesita revisar antes de activar al profesional.</p>
            </div>
          </div>

          <div className="admin-doc-grid">
            <DocumentPreview label="Foto de perfil" value={onboarding.profilePhotoUrl} />
            <DocumentPreview label="Carnet por delante" value={onboarding.identityDocumentFrontFile} />
            <DocumentPreview label="Carnet por detrás" value={onboarding.identityDocumentBackFile} />
            <DocumentPreview label="Certificado de antecedentes" value={onboarding.criminalRecordFile} />
          </div>
        </section>
      </section>
    </main>
  );
}
