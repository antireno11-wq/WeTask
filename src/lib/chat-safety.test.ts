import { describe, expect, it } from "vitest";
import { canShareContactDetails, messageContainsRestrictedContactInfo } from "./chat-safety";

describe("canShareContactDetails", () => {
  it("permite compartir contacto cuando booking ya está confirmado o avanzado", () => {
    expect(canShareContactDetails("CONFIRMED")).toBe(true);
    expect(canShareContactDetails("IN_PROGRESS")).toBe(true);
    expect(canShareContactDetails("COMPLETED")).toBe(true);
  });

  it("NO permite compartir en estados previos (PENDING/CREATED/PAYMENT_FAILED)", () => {
    expect(canShareContactDetails("PENDING")).toBe(false);
    expect(canShareContactDetails("CREATED")).toBe(false);
    expect(canShareContactDetails("PAYMENT_FAILED")).toBe(false);
    expect(canShareContactDetails("ASSIGNED")).toBe(false);
  });
});

describe("messageContainsRestrictedContactInfo", () => {
  it("detecta email con formato estándar", () => {
    expect(messageContainsRestrictedContactInfo("escribime a juan@gmail.com")).toBe(true);
    expect(messageContainsRestrictedContactInfo("Hola, soy maria@hotmail.cl, llamame")).toBe(true);
  });

  it("detecta teléfono chileno con prefijo +56 9", () => {
    expect(messageContainsRestrictedContactInfo("Mi telefono es +56 9 1234 5678")).toBe(true);
    expect(messageContainsRestrictedContactInfo("Anota: 9 8765 4321")).toBe(true);
  });

  it("detecta números de 8+ dígitos juntos", () => {
    expect(messageContainsRestrictedContactInfo("Llama al 98765432")).toBe(true);
  });

  it("detecta keywords sensibles (whatsapp, instagram, mi numero)", () => {
    expect(messageContainsRestrictedContactInfo("Te paso mi WhatsApp")).toBe(true);
    expect(messageContainsRestrictedContactInfo("Mi Instagram es @ana")).toBe(true);
    expect(messageContainsRestrictedContactInfo("Pasame tu numero por favor")).toBe(true);
    expect(messageContainsRestrictedContactInfo("llamame al rato")).toBe(true);
  });

  it("normaliza acentos al detectar keywords (teléfono cuenta como telefono)", () => {
    expect(messageContainsRestrictedContactInfo("Pasame tu teléfono")).toBe(true);
  });

  it("no marca como restringido un mensaje neutro", () => {
    expect(messageContainsRestrictedContactInfo("Hola, ¿a qué hora llegas?")).toBe(false);
    expect(messageContainsRestrictedContactInfo("Listo, te espero en la entrada principal")).toBe(false);
  });

  it("no marca falso positivo para email-like sin TLD válido", () => {
    expect(messageContainsRestrictedContactInfo("uso @anita como handle aqui")).toBe(false);
  });
});
