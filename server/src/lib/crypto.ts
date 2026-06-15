import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

/** A random 6-digit numeric code (zero-padded), as the mockups show. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** sha256(code + pepper) hex — codes are never stored in the clear. */
export function hashOtp(code: string): string {
  return createHash("sha256")
    .update(code + env.OTP_PEPPER)
    .digest("hex");
}

/** Constant-time compare of two hex digests of equal length. */
export function safeEqual(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  return timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex"));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
