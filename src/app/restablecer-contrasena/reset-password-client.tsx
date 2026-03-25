"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => token.length > 0 && newPassword.trim().length >= 8 && confirmPassword.trim().length >= 8, [confirmPassword, newPassword, token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (!token) {
      setError("El enlace de recuperación es inválido o está incompleto.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo restablecer la contraseña");
      setFeedback("Tu contraseña fue actualizada. Ya puedes volver a iniciar sesión.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-panel-card">
      <div className="login-panel-head">
        <p className="login-panel-kicker">Recuperación de contraseña</p>
        <h1>Restablece tu contraseña</h1>
        <p>Crea una nueva contraseña para volver a entrar a tu cuenta de WeTask.</p>
      </div>

      <form className="login-form-shell" onSubmit={submit}>
        <label>
          Nueva contraseña
          <div className="password-field">
            <input type={showPasswords ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            <button type="button" className="password-toggle" onClick={() => setShowPasswords((current) => !current)}>
              {showPasswords ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>
        <label>
          Repite la contraseña
          <div className="password-field">
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu nueva contraseña"
            />
            <button type="button" className="password-toggle" onClick={() => setShowPasswords((current) => !current)}>
              {showPasswords ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>
        <div className="login-primary-actions">
          <button className="cta small" type="submit" disabled={loading || !canSubmit}>
            {loading ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
          <a href="/ingresar/cliente" className="cta ghost small">
            Volver a acceder
          </a>
        </div>
      </form>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </div>
  );
}
