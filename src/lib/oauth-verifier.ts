import crypto from "crypto";

type GoogleJwk = {
  kty: "RSA";
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
};

type GoogleJwksResponse = {
  keys: GoogleJwk[];
};

// Cache public keys in memory to avoid fetching them on every request
let googleKeysCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;
let appleKeysCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchGoogleKeys(): Promise<GoogleJwk[]> {
  if (googleKeysCache && googleKeysCache.expiresAt > Date.now()) {
    return googleKeysCache.keys;
  }
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) {
    throw new Error("No se pudieron obtener las llaves públicas de Google");
  }
  const data = (await response.json()) as GoogleJwksResponse;
  googleKeysCache = {
    keys: data.keys,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  return data.keys;
}

async function fetchAppleKeys(): Promise<GoogleJwk[]> {
  if (appleKeysCache && appleKeysCache.expiresAt > Date.now()) {
    return appleKeysCache.keys;
  }
  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    throw new Error("No se pudieron obtener las llaves públicas de Apple");
  }
  const data = (await response.json()) as GoogleJwksResponse;
  appleKeysCache = {
    keys: data.keys,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  return data.keys;
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

export type VerifiedOAuthToken = {
  email: string;
  fullName: string;
  sub: string;
};

export async function verifyOAuthToken(
  provider: "GOOGLE" | "APPLE",
  idToken: string
): Promise<VerifiedOAuthToken> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Token ID mal formateado");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error("Token ID vacío en alguno de sus componentes");
  }

  // Parse header
  let header: { kid?: string; alg?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    throw new Error("Encabezado del token no es un JSON válido");
  }

  if (!header.kid) {
    throw new Error("Falta el campo 'kid' en el encabezado del token");
  }

  // Parse payload
  let payload: {
    iss?: string;
    aud?: string;
    exp?: number;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    sub?: string;
  };
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    throw new Error("Cuerpo del token no es un JSON válido");
  }

  // Verify expiration
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < nowInSeconds) {
    throw new Error("El token de autenticación ha expirado");
  }

  // Get keys based on provider
  let keys: GoogleJwk[];
  if (provider === "GOOGLE") {
    keys = await fetchGoogleKeys();
    // Validate Google Client ID (audience) and Issuer
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (googleClientId && payload.aud !== googleClientId) {
      throw new Error("El token no pertenece a la aplicación cliente configurada");
    }
    const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      throw new Error("El emisor del token no es válido para Google");
    }
  } else {
    keys = await fetchAppleKeys();
    // Validate Apple Client ID (audience) and Issuer
    const appleClientId = process.env.APPLE_CLIENT_ID;
    if (appleClientId && payload.aud !== appleClientId) {
      throw new Error("El token no pertenece a la aplicación cliente configurada");
    }
    if (payload.iss !== "https://appleid.apple.com") {
      throw new Error("El emisor del token no es válido para Apple");
    }
  }

  // Match kid
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error(`No se encontró llave pública correspondiente al kid: ${header.kid}`);
  }

  // Verify signature
  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({
      format: "jwk",
      key: jwk
    });
  } catch (error) {
    throw new Error(`No se pudo crear la clave pública desde el JWK: ${error instanceof Error ? error.message : "desconocido"}`);
  }

  const verifier = crypto.createVerify("SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  
  const isValid = verifier.verify(publicKey, Buffer.from(signatureB64, "base64url"));
  if (!isValid) {
    throw new Error("Firma del token inválida");
  }

  if (!payload.email) {
    throw new Error("El token no contiene un correo electrónico verificado");
  }

  const email = payload.email.trim().toLowerCase();
  
  // Format Name
  let fullName = "";
  if (payload.name) {
    fullName = payload.name;
  } else if (payload.given_name) {
    fullName = `${payload.given_name} ${payload.family_name ?? ""}`.trim();
  } else {
    // Fallback if no name fields exist (e.g. sometimes Apple handles name only on first login)
    fullName = email.split("@")[0] || "Usuario WeTask";
  }

  return {
    email,
    fullName,
    sub: payload.sub || email
  };
}
