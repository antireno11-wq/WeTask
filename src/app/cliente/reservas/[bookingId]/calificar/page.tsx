import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { BookingRatingForm } from "@/components/booking-rating-form";
import { MarketNav } from "@/components/market-nav";
import { decodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const REVIEWABLE_STATES = new Set([
  "AWAITING_CUSTOMER_CONFIRMATION",
  "PAYOUT_SCHEDULED",
  "COMPLETED"
]);

export default async function CalificarPage({ params }: { params: { bookingId: string } }) {
  // Required to opt page into dynamic rendering (cookies/headers).
  headers();

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const identity = decodeSessionCookie(sessionCookie);

  if (!identity.userId) {
    redirect(`/ingresar/cliente?next=/cliente/reservas/${params.bookingId}/calificar`);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: {
      service: { select: { name: true } },
      pro: { select: { id: true, fullName: true } },
      review: { select: { id: true } }
    }
  });

  if (!booking) notFound();
  if (booking.customerId !== identity.userId && identity.role !== "ADMIN") {
    notFound();
  }

  const canReview = REVIEWABLE_STATES.has(booking.status);
  const alreadyReviewed = Boolean(booking.review);

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide" style={{ display: "grid", gap: 16, maxWidth: 720, marginInline: "auto" }}>
          <Link href={`/cliente/reservas/${params.bookingId}`} className="cta ghost small" style={{ justifySelf: "start" }}>
            ← Volver a la reserva
          </Link>

          {alreadyReviewed ? (
            <section className="auth-flow-panel" style={{ padding: 32, textAlign: "center", display: "grid", gap: 14 }}>
              <h1 style={{ margin: 0, fontSize: 24, color: "#17324d" }}>Ya enviaste tu reseña</h1>
              <p style={{ margin: 0, color: "#48627d" }}>
                Gracias por compartir tu experiencia con {booking.pro?.fullName ?? "tu profesional"}.
              </p>
              <Link href="/cliente" className="cta">
                Volver a mis reservas
              </Link>
            </section>
          ) : !canReview ? (
            <section className="auth-flow-panel" style={{ padding: 32, textAlign: "center", display: "grid", gap: 14 }}>
              <h1 style={{ margin: 0, fontSize: 22, color: "#17324d" }}>
                Aún no puedes calificar
              </h1>
              <p style={{ margin: 0, color: "#48627d" }}>
                Vas a poder dejar tu reseña una vez que el profesional cierre el servicio.
              </p>
              <Link href={`/cliente/reservas/${params.bookingId}`} className="cta">
                Volver al detalle
              </Link>
            </section>
          ) : (
            <BookingRatingForm
              bookingId={booking.id}
              authorId={booking.customerId}
              proId={booking.pro?.id ?? null}
              proName={booking.pro?.fullName ?? "tu profesional"}
              serviceName={booking.service?.name ?? "el servicio"}
            />
          )}
        </section>
      </div>
    </main>
  );
}
