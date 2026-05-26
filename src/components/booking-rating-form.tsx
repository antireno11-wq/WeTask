"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fireConfetti } from "@/lib/confetti";

type Props = {
  bookingId: string;
  authorId: string;
  proId: string | null;
  proName: string;
  serviceName: string;
};

const POSITIVE_TAGS = [
  "Muy puntual",
  "Súper amable",
  "Trabajo impecable",
  "Respondió rápido",
  "Recomendado",
  "Profesional",
  "Atento al detalle",
  "Trato cercano"
];

export function BookingRatingForm({ bookingId, authorId, proId, proName, serviceName }: Props) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [punctuality, setPunctuality] = useState<number>(0);
  const [quality, setQuality] = useState<number>(0);
  const [communication, setCommunication] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const submit = async () => {
    if (rating < 1) {
      setError("Tocá al menos una estrella para enviar tu reseña.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const tagsLine =
        selectedTags.size > 0 ? `\n\nLo que más destacó: ${Array.from(selectedTags).join(", ")}.` : "";
      const fullComment = `${comment.trim()}${tagsLine}`.trim();

      const response = await fetch("/api/marketplace/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          authorId,
          rating,
          punctuality: punctuality || undefined,
          quality: quality || undefined,
          communication: communication || undefined,
          comment: fullComment || undefined
        })
      });
      const data = (await response.json()) as { review?: unknown; error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || data.error || `No se pudo enviar la reseña (${response.status})`);
      }
      fireConfetti();
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <section
        className="auth-flow-panel"
        style={{ padding: 32, textAlign: "center", display: "grid", gap: 18, placeItems: "center" }}
      >
        <div
          aria-hidden
          style={{
            width: 76,
            height: 76,
            borderRadius: 999,
            background: "linear-gradient(135deg,#76f2c0 0%,#18a6d5 100%)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 18px 36px rgba(24,166,213,0.32)"
          }}
        >
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" aria-hidden>
            <path d="M5 12.5l4 4 10-10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 style={{ margin: 0, color: "#17324d", fontSize: 26 }}>¡Gracias por tu reseña!</h2>
        <p style={{ margin: 0, color: "#48627d", fontSize: 16, maxWidth: 460 }}>
          {proName} verá tu calificación y comentarios. Tu opinión nos ayuda a mantener la calidad del marketplace.
        </p>
        <div className="cta-row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          {proId ? (
            <Link href={`/reservar?proId=${encodeURIComponent(proId)}`} className="cta">
              Reservar de nuevo con {proName.split(" ")[0]}
            </Link>
          ) : null}
          <Link href="/cliente" className="cta ghost">
            Volver a mis reservas
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-flow-panel" style={{ padding: 28, display: "grid", gap: 24 }}>
      <div>
        <p className="auth-flow-kicker" style={{ margin: 0 }}>¿Cómo estuvo?</p>
        <h1 style={{ margin: "4px 0 8px", fontSize: 26, color: "#17324d" }}>
          Calificá a {proName}
        </h1>
        <p style={{ margin: 0, color: "#48627d", fontSize: 15 }}>{serviceName}</p>
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {[1, 2, 3, 4, 5].map((value) => {
          const isLit = (hover || rating) >= value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${value} estrella${value > 1 ? "s" : ""}`}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 4,
                transition: "transform 120ms ease",
                transform: rating === value ? "scale(1.18)" : isLit ? "scale(1.05)" : "scale(1)"
              }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M12 2l2.39 4.84 5.34.78-3.86 3.77.91 5.31L12 14.27l-4.78 2.43.91-5.31-3.86-3.77 5.34-.78z"
                  fill={isLit ? "#ff6a00" : "#eef4fb"}
                  stroke={isLit ? "#ff6a00" : "#cdddee"}
                  strokeWidth="1"
                />
              </svg>
            </button>
          );
        })}
      </div>

      {rating > 0 ? (
        <>
          <div style={{ display: "grid", gap: 14 }}>
            <SubScore label="Puntualidad" value={punctuality} onChange={setPunctuality} />
            <SubScore label="Calidad" value={quality} onChange={setQuality} />
            <SubScore label="Comunicación" value={communication} onChange={setCommunication} />
          </div>

          <div>
            <p style={{ margin: "0 0 10px", fontSize: 14, color: "#48627d" }}>
              <strong style={{ color: "#17324d" }}>¿Qué destacar?</strong> (opcional, tocá los que apliquen)
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {POSITIVE_TAGS.map((tag) => {
                const selected = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: selected ? "2px solid #18a6d5" : "1px solid #cdddee",
                      background: selected ? "#e7f4fb" : "#ffffff",
                      color: selected ? "#173e73" : "#48627d",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: selected ? 700 : 500,
                      transition: "all 100ms"
                    }}
                  >
                    {selected ? "✓ " : ""}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#48627d" }}>
              <strong style={{ color: "#17324d" }}>Comentario</strong> (opcional)
            </span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Contale a otros clientes cómo fue tu experiencia..."
              rows={4}
              maxLength={1000}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid #cdddee",
                font: "inherit",
                resize: "vertical",
                minHeight: 100
              }}
            />
          </label>
        </>
      ) : (
        <p style={{ margin: 0, color: "#48627d", fontSize: 14, textAlign: "center" }}>
          Tocá las estrellas para empezar tu reseña.
        </p>
      )}

      {error ? <p className="feedback error">{error}</p> : null}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="cta" disabled={rating < 1 || submitting} onClick={() => void submit()}>
          {submitting ? "Enviando..." : "Enviar mi reseña"}
        </button>
        <Link href="/cliente" className="cta ghost">
          Después
        </Link>
      </div>
    </section>
  );
}

function SubScore({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 14, color: "#17324d", fontWeight: 600 }}>{label}</span>
      <div style={{ display: "inline-flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((v) => {
          const isLit = value >= v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v === value ? 0 : v)}
              aria-label={`${label} ${v}`}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 2,
                transition: "transform 100ms"
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M12 2l2.39 4.84 5.34.78-3.86 3.77.91 5.31L12 14.27l-4.78 2.43.91-5.31-3.86-3.77 5.34-.78z"
                  fill={isLit ? "#1d7fc6" : "#eef4fb"}
                  stroke={isLit ? "#1d7fc6" : "#cdddee"}
                  strokeWidth="1"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
