import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <p style={{ color: "#7c4dff", fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Error 404</p>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Página no encontrada.</h1>
        <p style={{ color: "#48627d", marginBottom: 24 }}>
          La URL que buscas no existe o fue movida. Verifica el link o vuelve al inicio.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{ padding: "10px 18px", background: "#7c4dff", color: "white", borderRadius: 8, fontSize: 14, textDecoration: "none" }}
          >
            Ir al inicio
          </Link>
          <Link
            href="/servicios"
            style={{ padding: "10px 18px", background: "#f0f1f5", color: "#1a1a2e", borderRadius: 8, fontSize: 14, textDecoration: "none" }}
          >
            Ver servicios
          </Link>
        </div>
      </div>
    </main>
  );
}
