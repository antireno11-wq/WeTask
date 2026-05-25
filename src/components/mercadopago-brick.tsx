"use client";

import { useEffect, useRef, useState } from "react";

type BrickCallbackPayload = {
  token: string;
  payment_method_id?: string;
  issuer_id?: string | number;
  installments?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
};

type Props = {
  amountClp: number;
  /**
   * Email del pagador para pre-llenar el formulario.
   */
  payerEmail?: string | null;
  /**
   * Se invoca cuando el SDK devuelve un token tokenizado de tarjeta listo
   * para mandar a /api/bookings/checkout. NO procesa el pago todavía — el
   * checkout debe llamarse después con este token.
   */
  onCardTokenized: (payload: BrickCallbackPayload) => void;
  onError?: (error: unknown) => void;
};

type MPCardForm = { unmount?: () => void };

const SDK_SRC = "https://sdk.mercadopago.com/js/v2";
const BRICK_CONTAINER_ID = "mp-card-payment-brick-container";

let scriptPromise: Promise<void> | null = null;
function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SDK MP solo carga en cliente"));
  if (window.MercadoPago) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falló al cargar SDK MercadoPago")));
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falló al cargar SDK MercadoPago"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Wrapper de MercadoPago "Card Payment Brick" (SDK V2).
 * Devuelve un token + datos del payment_method al usuario via onCardTokenized.
 *
 * Requiere NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY configurado.
 *
 * Brick maneja:
 *  - Card form (Visa/Master/Amex)
 *  - Apple Pay y Google Pay (auto-detectados si el browser soporta)
 *  - 3DS2 automático
 *  - Validación local + remota
 */
export function MercadoPagoBrick({ amountClp, payerEmail, onCardTokenized, onError }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const formRef = useRef<MPCardForm | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey) {
      setError("MercadoPago no está configurado (falta NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY).");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadMercadoPagoSdk();
        if (cancelled) return;
        const MercadoPagoCtor = window.MercadoPago;
        if (!MercadoPagoCtor) {
          setError("SDK MercadoPago no se cargó correctamente.");
          return;
        }
        const mp = new MercadoPagoCtor(publicKey, { locale: "es-CL" });
        const bricksBuilder = mp.bricks();

        const settings: Record<string, unknown> = {
          initialization: {
            amount: amountClp,
            payer: payerEmail ? { email: payerEmail } : undefined
          },
          customization: {
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: 12
            },
            visual: { style: { theme: "default" } }
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onSubmit: async (cardFormData: BrickCallbackPayload) => {
              try {
                onCardTokenized(cardFormData);
              } catch (err) {
                onError?.(err);
              }
            },
            onError: (mpError: unknown) => {
              const message = mpError instanceof Error ? mpError.message : "Error en el formulario de pago";
              setError(message);
              onError?.(mpError);
            }
          }
        };

        formRef.current = await bricksBuilder.create("cardPayment", BRICK_CONTAINER_ID, settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando MercadoPago Brick");
      }
    })();

    return () => {
      cancelled = true;
      formRef.current?.unmount?.();
      formRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountClp, payerEmail, publicKey]);

  if (!publicKey) {
    return (
      <div className="feedback error">
        Configurá <code>NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY</code> en el servidor para habilitar pagos.
      </div>
    );
  }

  return (
    <div>
      {!ready && !error ? <p className="empty">Cargando formulario de pago seguro...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      <div id={BRICK_CONTAINER_ID} />
    </div>
  );
}
