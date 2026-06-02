"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { fireConfetti } from "@/lib/confetti";

type StatusResponse = {
  status?: "ACTIVE" | "DISABLED" | "UNVERIFIED" | null;
  mpUserId?: string | null;
};

type SessionPayload = {
  userId: string;
  fullName?: string | null;
  role?: string | null;
};

const SEEN_FLAG_PREFIX = "wetask_perfil_aprobado_seen_";

export default function PerfilAprobadoPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fireConfetti({ particles: 160, durationMs: 2600 });
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: SessionPayload | null };
        if (!data.session?.userId) {
          router.push("/ingresar/tasker");
          return;
        }
        setSession(data.session);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(`${SEEN_FLAG_PREFIX}${data.session.userId}`, "1");
        }
      } catch {
        router.push("/ingresar/tasker");
      }
    };
    void loadSession();
  }, [router]);

  useEffect(() => {
    if (!session?.userId) return;
    const loadMp = async () => {
      try {
        const response = await fetch("/api/payments/mp/oauth/status", { cache: "no-store" });
        const data = (await response.json()) as StatusResponse;
        if (response.ok) {
          setMpConnected(data.status === "ACTIVE" && Boolean(data.mpUserId));
        } else {
          setMpConnected(false);
        }
      } catch {
        setMpConnected(false);
      }
    };
    void loadMp();
  }, [session?.userId]);

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide" style={{ display: "grid", gap: 24 }}>
          <section
            className="auth-flow-panel auth-flow-panel-wide"
            style={{
              padding: 40,
              display: "grid",
              gap: 24,
              placeItems: "center",
              textAlign: "center"
            }}
          >
            <div
              aria-hidden
              style={{
                width: 96,
                height: 96,
                borderRadius: 999,
                background: "linear-gradient(135deg,#76f2c0 0%,#18a6d5 100%)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 22px 44px rgba(24,166,213,0.34)"
              }}
            >
              <svg viewBox="0 0 24 24" width="50" height="50" fill="none" aria-hidden>
                <path
                  d="M12 2l2.39 4.84 5.34.78-3.86 3.77.91 5.31L12 14.27l-4.78 2.43.91-5.31-3.86-3.77 5.34-.78z"
                  fill="white"
                />
              </svg>
            </div>

            <div>
              <p className="auth-flow-kicker" style={{ margin: 0 }}>¡Bienvenido a WeTask!</p>
              <h1 style={{ margin: "8px 0 12px", fontSize: 36, color: "#17324d" }}>
                Tu perfil fue aprobado {session?.fullName ? `, ${session.fullName.split(" ")[0]}` : ""}.
              </h1>
              <p style={{ maxWidth: 560, margin: "0 auto", color: "#48627d", fontSize: 17, lineHeight: 1.6 }}>
                Ya pasaste la validación interna del equipo. Para empezar a recibir reservas pagadas necesitás
                dos pasos cortos.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
                width: "100%",
                maxWidth: 620
              }}
            >
              <article
                style={{
                  padding: 24,
                  borderRadius: 20,
                  border: mpConnected === false ? "2px solid #ff6a00" : "1px solid rgba(34,97,160,0.18)",
                  background: "#ffffff",
                  textAlign: "left",
                  display: "grid",
                  gap: 8
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: mpConnected === false ? "#b34a00" : mpConnected ? "#177245" : "#5f7691"
                  }}
                >
                  Paso 1
                  {mpConnected ? <span>· ✓ Conectado</span> : mpConnected === false ? <span>· Pendiente</span> : null}
                </span>
                <h3 style={{ margin: 0, fontSize: 18, color: "#17324d" }}>Conectá MercadoPago</h3>
                <p style={{ margin: 0, color: "#48627d", fontSize: 14 }}>
                  Sin esto, tus horarios no aparecen en búsqueda y no podés recibir reservas pagadas.
                </p>
                <Link
                  href="/pro"
                  className={`cta ${mpConnected ? "ghost" : ""}`}
                  style={{ marginTop: 8, justifySelf: "start" }}
                >
                  {mpConnected ? "Ver mi cuenta" : "Conectar MercadoPago"}
                </Link>
              </article>

              <article
                style={{
                  padding: 24,
                  borderRadius: 20,
                  border: "1px solid rgba(34,97,160,0.18)",
                  background: "#ffffff",
                  textAlign: "left",
                  display: "grid",
                  gap: 8
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "#5f7691"
                  }}
                >
                  Paso 2
                </span>
                <h3 style={{ margin: 0, fontSize: 18, color: "#17324d" }}>Configurá tu disponibilidad</h3>
                <p style={{ margin: 0, color: "#48627d", fontSize: 14 }}>
                  Definí qué días y horas estás disponible. Tus clientes te reservan solo en esos horarios.
                </p>
                <Link href="/pro" className="cta ghost" style={{ marginTop: 8, justifySelf: "start" }}>
                  Abrir calendario
                </Link>
              </article>
            </div>

            <p style={{ margin: 0, fontSize: 13, color: "#5f7691" }}>
              Vas a poder volver a este panel desde la sección &ldquo;Mi cuenta&rdquo; de tu nav.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
