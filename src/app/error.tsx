"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <p style={{ color: "#7c4dff", fontWeight: 600, marginBottom: 8 }}>Algo salió mal</p>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>No pudimos cargar esta sección.</h1>
        <p style={{ color: "#48627d", marginBottom: 24 }}>
          El equipo fue notificado. Podés reintentar o volver al inicio.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{ padding: "10px 18px", background: "#7c4dff", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
          >
            Reintentar
          </button>
          <Link
            href="/"
            style={{ padding: "10px 18px", background: "#f0f1f5", color: "#1a1a2e", borderRadius: 8, fontSize: 14, textDecoration: "none" }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
