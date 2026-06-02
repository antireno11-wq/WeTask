"use client";

import { useEffect, useState } from "react";

type Status = "ACTIVE" | "DISABLED" | "UNVERIFIED" | null;

export function MercadoPagoConnectionCard() {
  const [status, setStatus] = useState<Status>(null);
  const [mpUserId, setMpUserId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const loadStatus = async () => {
    try {
      const response = await fetch("/api/payments/mp/oauth/status", { cache: "no-store" });
      const data = (await response.json()) as {
        status?: Status;
        mpUserId?: string | null;
        connectedAt?: string | null;
        oauthConfigured?: boolean;
      };
      if (response.ok) {
        setStatus(data.status ?? null);
        setMpUserId(data.mpUserId ?? null);
        setConnectedAt(data.connectedAt ?? null);
        setOauthConfigured(data.oauthConfigured ?? false);
      }
    } catch {
      // silencioso: el componente se mantiene en estado "no conectado"
    }
  };

  useEffect(() => {
    void loadStatus();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mpConnected") === "true") {
      setInfo("Tu cuenta MercadoPago se conectó correctamente. Ya podés recibir reservas pagadas con escrow.");
      params.delete("mpConnected");
      const q = params.toString();
      window.history.replaceState(null, "", q ? `${window.location.pathname}?${q}` : window.location.pathname);
    }
    const mpError = params.get("mpError");
    if (mpError) {
      const map: Record<string, string> = {
        not_configured: "OAuth de MercadoPago aún no está configurado en la plataforma.",
        missing_code_or_state: "El proveedor no devolvió el código de autorización.",
        invalid_state: "La sesión de autorización expiró o no es válida. Probá de nuevo.",
        expired_state: "La sesión de autorización expiró. Probá de nuevo.",
        exchange_failed: "MercadoPago rechazó el intercambio de tokens. Probá de nuevo en unos minutos.",
        access_denied: "Cancelaste la autorización en MercadoPago."
      };
      setError(map[mpError] ?? `Error de conexión: ${mpError}`);
      params.delete("mpError");
      const q = params.toString();
      window.history.replaceState(null, "", q ? `${window.location.pathname}?${q}` : window.location.pathname);
    }
  }, []);

  const connect = async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch("/api/payments/mp/oauth/init", { method: "POST" });
      const data = (await response.json()) as { authorizationUrl?: string; error?: string };
      if (!response.ok || !data.authorizationUrl) {
        throw new Error(data.error || "No se pudo iniciar la conexión con MercadoPago");
      }
      window.location.href = data.authorizationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Si desconectas MercadoPago dejarás de recibir reservas nuevas. ¿Continuar?")) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch("/api/payments/mp/oauth/disconnect", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo desconectar");
      setStatus(null);
      setMpUserId(null);
      setConnectedAt(null);
      setInfo("MercadoPago desconectado. Tus horarios dejarán de aparecer en búsqueda.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const connected = status === "ACTIVE" && Boolean(mpUserId);

  return (
    <section className="admin-section-card" style={{ marginTop: 16 }}>
      <div className="admin-section-head">
        <div>
          <h3>Cuenta MercadoPago</h3>
          <p>
            Conectá tu cuenta de MercadoPago para recibir pagos con escrow real. Mientras no esté conectada, tus horarios
            no aparecen en búsqueda y no podés recibir reservas pagadas.
          </p>
        </div>
        {connected ? (
          <span className="status status-completed">Conectada</span>
        ) : (
          <span className="status status-cancelled">No conectada</span>
        )}
      </div>

      {connected ? (
        <div className="admin-kv-grid">
          <div>
            <strong>ID MercadoPago</strong>
            <span>{mpUserId}</span>
          </div>
          <div>
            <strong>Conectada el</strong>
            <span>{connectedAt ? new Date(connectedAt).toLocaleString("es-CL") : "—"}</span>
          </div>
        </div>
      ) : (
        <p style={{ marginTop: 12, color: "#48627d" }}>
          Te vamos a redirigir a MercadoPago para autorizar a WeTask como marketplace y cobrar en tu nombre. Necesitás
          tener cuenta de MercadoPago (vendedor) — si no tenés, la creás gratis en mercadopago.cl.
        </p>
      )}

      {oauthConfigured === false ? (
        <p className="feedback error" style={{ marginTop: 12 }}>
          La integración OAuth de MercadoPago aún no está activa en la plataforma. Pedile al equipo que configure
          MERCADOPAGO_APP_ID y MERCADOPAGO_APP_SECRET.
        </p>
      ) : null}

      <div className="cta-row" style={{ marginTop: 16 }}>
        {connected ? (
          <button type="button" className="cta ghost" onClick={() => void disconnect()} disabled={loading}>
            {loading ? "Desconectando..." : "Desconectar MercadoPago"}
          </button>
        ) : (
          <button type="button" className="cta" onClick={() => void connect()} disabled={loading}>
            {loading ? "Redirigiendo..." : "Conectar MercadoPago"}
          </button>
        )}
      </div>

      {info ? <p className="feedback ok">{info}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
