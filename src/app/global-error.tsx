"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, marginBottom: 12 }}>Algo se rompió.</h1>
            <p style={{ color: "#48627d", marginBottom: 24 }}>
              Recibimos el error y lo vamos a revisar. Mientras tanto puedes reintentar o volver al inicio.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{ padding: "10px 18px", background: "#7c4dff", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
              >
                Reintentar
              </button>
              <a
                href="/"
                style={{ padding: "10px 18px", background: "#f0f1f5", color: "#1a1a2e", borderRadius: 8, fontSize: 14, textDecoration: "none" }}
              >
                Ir al inicio
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
