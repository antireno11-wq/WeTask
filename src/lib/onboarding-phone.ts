import { signSession, verifySession } from "@/lib/security";

export const PUBLIC_ONBOARDING_PHONE_COOKIE = "wetask_onboarding_phone";
export const PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE = "wetask_onboarding_phone_verified";

type PhonePendingCookie = {
  phone: string;
  codeHash: string;
  exp: number;
};

type PhoneVerifiedCookie = {
  phone: string;
  verified: true;
  exp: number;
};

export function encodePendingPhoneVerification(payload: PhonePendingCookie) {
  return signSession(payload);
}

export function decodePendingPhoneVerification(raw: string | undefined) {
  return raw ? verifySession<PhonePendingCookie>(raw) : null;
}

export function encodeVerifiedPhone(payload: PhoneVerifiedCookie) {
  return signSession(payload);
}

export function decodeVerifiedPhone(raw: string | undefined) {
  return raw ? verifySession<PhoneVerifiedCookie>(raw) : null;
}
