"use client";

import type { FormEvent } from "react";

export type BookingChatMessage = {
  id: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  sender: { id?: string; fullName: string };
};

type BookingChatPanelProps = {
  messages: BookingChatMessage[];
  currentUserId: string;
  chatBody: string;
  sending?: boolean;
  emptyLabel?: string;
  inputPlaceholder?: string;
  disabled?: boolean;
  helperText?: string | null;
  onChatBodyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function formatChatTime(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function BookingChatPanel({
  messages,
  currentUserId,
  chatBody,
  sending = false,
  emptyLabel = "Todavía no hay mensajes en esta reserva.",
  inputPlaceholder = "Escribe tu mensaje",
  disabled = false,
  helperText = null,
  onChatBodyChange,
  onSubmit
}: BookingChatPanelProps) {
  return (
    <div className="booking-chat-shell">
      <div className="chat-box client-booking-chat booking-chat-thread">
        {messages.length === 0 ? (
          <p className="empty booking-chat-empty">{emptyLabel}</p>
        ) : (
          messages.map((item) => {
            const isOwnMessage = item.sender.id === currentUserId;
            return (
              <article
                key={item.id}
                className={`booking-chat-message ${isOwnMessage ? "mine" : "theirs"}`}
                aria-label={isOwnMessage ? "Tu mensaje" : `Mensaje de ${item.sender.fullName}`}
              >
                <div className="booking-chat-bubble">
                  <div className="booking-chat-meta">
                    <strong>{isOwnMessage ? "Tú" : item.sender.fullName}</strong>
                    <span>{formatChatTime(item.createdAt)}</span>
                  </div>
                  <p>{item.body}</p>
                  {item.imageUrl ? (
                    <a href={item.imageUrl} target="_blank" rel="noreferrer" className="booking-chat-attachment">
                      Ver archivo adjunto
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      <form className="booking-chat-composer" onSubmit={onSubmit}>
        <label className="booking-chat-input">
          <span>Mensaje</span>
          <textarea
            rows={4}
            value={chatBody}
            onChange={(event) => onChatBodyChange(event.target.value)}
            placeholder={inputPlaceholder}
            disabled={disabled || sending}
          />
        </label>
        <div className="booking-chat-actions">
          {helperText ? <p className="booking-chat-helper">{helperText}</p> : <span />}
          <button className="cta small" type="submit" disabled={disabled || sending || chatBody.trim().length === 0}>
            {sending ? "Enviando..." : "Enviar mensaje"}
          </button>
        </div>
      </form>
    </div>
  );
}
