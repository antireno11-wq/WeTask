import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeroShell } from "@/components/admin-hero-shell";
import { AdminDisputeResolutionActions } from "@/components/admin-dispute-resolution-actions";
import { prisma } from "@/lib/prisma";
import { resolveAssetUrl } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("es-CL");
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("es-CL")}`;
}

const statusLabel: Record<string, string> = {
  OPEN: "Abierta",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelta",
  CLOSED: "Cerrada"
};

const statusClass: Record<string, string> = {
  OPEN: "status-cancelled",
  IN_REVIEW: "status-pending",
  RESOLVED: "status-completed",
  CLOSED: "status-accepted"
};

type EvidenceItem = {
  name?: string;
  type?: string;
  size?: number;
  dataUrl?: string;
};

function parseEvidence(raw: unknown): EvidenceItem[] {
  if (!Array.isArray(raw)) return [];
  const out: EvidenceItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    out.push({
      name: typeof obj.name === "string" ? obj.name : undefined,
      type: typeof obj.type === "string" ? obj.type : undefined,
      size: typeof obj.size === "number" ? obj.size : undefined,
      dataUrl: typeof obj.dataUrl === "string" ? obj.dataUrl : undefined
    });
  }
  return out;
}

export default async function AdminDisputeDetailPage({ params }: { params: { disputeId: string } }) {
  const dispute = await prisma.disputeTicket.findUnique({
    where: { id: params.disputeId },
    include: {
      booking: {
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          pro: { select: { id: true, fullName: true, email: true, phone: true } },
          service: { select: { id: true, name: true } },
          payment: {
            select: {
              id: true,
              provider: true,
              providerPaymentId: true,
              status: true,
              amountClp: true,
              paidAt: true,
              refundedAt: true,
              last4: true
            }
          }
        }
      }
    }
  });

  if (!dispute) notFound();

  const evidence = parseEvidence(dispute.evidence);
  const evidenceWithUrls = await Promise.all(
    evidence.map(async (item) => {
      const url = item.dataUrl ? await resolveAssetUrl(item.dataUrl) : null;
      return { ...item, resolvedUrl: url };
    })
  );

  const canRefund =
    !!dispute.booking.payment?.providerPaymentId &&
    dispute.booking.payment?.provider === "MERCADOPAGO" &&
    dispute.status !== "CLOSED" &&
    dispute.status !== "RESOLVED";

  const resolvedBy = dispute.resolvedById
    ? await prisma.user.findUnique({
        where: { id: dispute.resolvedById },
        select: { fullName: true, email: true }
      })
    : null;

  return (
    <AdminHeroShell>
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Reclamo</span>
          <h2>Resolución de disputa</h2>
          <p>Revisa la evidencia, la conversación de partes y emite la decisión final.</p>
        </div>
        <div className="cta-row">
          <span className={`status ${statusClass[dispute.status]}`}>{statusLabel[dispute.status]}</span>
          <Link href="/admin/disputes" className="cta ghost small">
            Volver a la cola
          </Link>
        </div>
      </div>

      <div className="admin-detail-grid">
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Reserva en disputa</h3>
              <p>Datos del booking afectado y montos involucrados.</p>
            </div>
          </div>
          <div className="admin-kv-grid">
            <div>
              <strong>Booking</strong>
              <span>{dispute.booking.id}</span>
            </div>
            <div>
              <strong>Servicio</strong>
              <span>{dispute.booking.service?.name ?? "—"}</span>
            </div>
            <div>
              <strong>Fecha agendada</strong>
              <span>{formatDate(dispute.booking.scheduledAt)}</span>
            </div>
            <div>
              <strong>Estado booking</strong>
              <span>{dispute.booking.status}</span>
            </div>
            <div>
              <strong>Estado pago</strong>
              <span>{dispute.booking.paymentStatus}</span>
            </div>
            <div>
              <strong>Monto total</strong>
              <span>{formatMoney(dispute.booking.totalPriceClp)}</span>
            </div>
            <div>
              <strong>Provider payment id</strong>
              <span>{dispute.booking.payment?.providerPaymentId ?? "—"}</span>
            </div>
            <div>
              <strong>Tarjeta</strong>
              <span>{dispute.booking.payment?.last4 ? `••• ${dispute.booking.payment.last4}` : "—"}</span>
            </div>
          </div>
        </section>

        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Partes</h3>
              <p>Contacto del cliente y del profesional.</p>
            </div>
          </div>
          <div className="admin-kv-grid">
            <div>
              <strong>Cliente</strong>
              <span>{dispute.booking.customer.fullName}</span>
              <span style={{ display: "block", color: "#5f7691", fontSize: 14 }}>{dispute.booking.customer.email}</span>
              {dispute.booking.customer.phone ? (
                <span style={{ display: "block", color: "#5f7691", fontSize: 14 }}>{dispute.booking.customer.phone}</span>
              ) : null}
            </div>
            <div>
              <strong>Profesional</strong>
              <span>{dispute.booking.pro?.fullName ?? "—"}</span>
              {dispute.booking.pro?.email ? (
                <span style={{ display: "block", color: "#5f7691", fontSize: 14 }}>{dispute.booking.pro.email}</span>
              ) : null}
              {dispute.booking.pro?.phone ? (
                <span style={{ display: "block", color: "#5f7691", fontSize: 14 }}>{dispute.booking.pro.phone}</span>
              ) : null}
            </div>
            <div>
              <strong>Abierto por</strong>
              <span>{dispute.openedById === dispute.booking.customerId ? "Cliente" : dispute.openedById === dispute.booking.proId ? "Profesional" : "Otro"}</span>
            </div>
            <div>
              <strong>Categoría</strong>
              <span>{dispute.category ?? "—"}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Motivo del reclamo</h3>
            <p>Lo escrito por quien abrió el ticket.</p>
          </div>
        </div>
        <div className="admin-note-block">
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{dispute.reason}</p>
        </div>
      </section>

      {evidenceWithUrls.length > 0 ? (
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Evidencia adjunta</h3>
              <p>{evidenceWithUrls.length} archivo(s) subidos por la parte que abrió el reclamo.</p>
            </div>
          </div>
          <div className="admin-doc-grid">
            {evidenceWithUrls.map((item, index) => (
              <article key={index} className="admin-doc-card">
                <div className="admin-doc-head">
                  <strong>{item.name ?? `Archivo ${index + 1}`}</strong>
                  {item.resolvedUrl ? (
                    <a href={item.resolvedUrl} target="_blank" rel="noreferrer" className="cta ghost small">
                      Abrir archivo
                    </a>
                  ) : null}
                </div>
                {item.resolvedUrl && (item.type ?? "").startsWith("image/") ? (
                  <img src={item.resolvedUrl} alt={item.name ?? "evidencia"} className="admin-doc-preview" />
                ) : (
                  <p>
                    {item.type ?? "Archivo"} · {item.size ? `${Math.round(item.size / 1024)} KB` : "tamaño desconocido"}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Timeline</h3>
            <p>Hitos del ticket.</p>
          </div>
        </div>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          <li
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              border: "1px solid rgba(34,97,160,0.18)",
              background: "#f4f8fd"
            }}
          >
            <strong>Abierta</strong>
            <p style={{ margin: "6px 0 0", color: "#48627d", fontSize: 14 }}>{formatDate(dispute.createdAt)}</p>
          </li>
          {dispute.dueDateAt ? (
            <li
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid rgba(34,97,160,0.18)",
                background: "#f4f8fd"
              }}
            >
              <strong>SLA (vencimiento)</strong>
              <p style={{ margin: "6px 0 0", color: "#48627d", fontSize: 14 }}>{formatDate(dispute.dueDateAt)}</p>
            </li>
          ) : null}
          {dispute.refundedAt ? (
            <li
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid rgba(34,97,160,0.18)",
                background: "#f4f8fd"
              }}
            >
              <strong>Reembolso procesado</strong>
              <p style={{ margin: "6px 0 0", color: "#48627d", fontSize: 14 }}>
                {formatDate(dispute.refundedAt)} · {formatMoney(dispute.refundAmountClp)} · MP id {dispute.refundedProviderPaymentId ?? "—"}
              </p>
            </li>
          ) : null}
          {dispute.resolvedAt ? (
            <li
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid rgba(34,97,160,0.18)",
                background: "#f4f8fd"
              }}
            >
              <strong>Resuelta ({statusLabel[dispute.status]})</strong>
              <p style={{ margin: "6px 0 0", color: "#48627d", fontSize: 14 }}>
                {formatDate(dispute.resolvedAt)} · por {resolvedBy?.fullName ?? resolvedBy?.email ?? "—"}
              </p>
              {dispute.resolution ? (
                <p style={{ margin: "6px 0 0", color: "#17324d", whiteSpace: "pre-wrap" }}>{dispute.resolution}</p>
              ) : null}
            </li>
          ) : null}
        </ol>
      </section>

      <AdminDisputeResolutionActions
        disputeId={dispute.id}
        currentStatus={dispute.status as "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED"}
        paymentAmountClp={dispute.booking.payment?.amountClp ?? null}
        alreadyRefundedAmountClp={dispute.refundAmountClp ?? null}
        canRefund={canRefund}
      />
    </AdminHeroShell>
  );
}
