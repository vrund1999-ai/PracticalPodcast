import type { Request, Response } from "express";
import { z } from "zod";
import { badRequest, tooMany } from "../lib/errors";
import { isValidEmail, normalizeEmail } from "../lib/crypto";
import { allow } from "../middleware/rateLimit";
import { requestCode, verifyCode } from "../services/auth.service";
import { createSession, setSessionCookie, clearSessionCookie, destroySession } from "../services/session.service";
import { toUserDTO } from "../services/user.service";

const emailBody = z.object({ email: z.string() });
const verifyBody = z.object({ email: z.string(), code: z.string() });

const FIFTEEN_MIN = 15 * 60 * 1000;

export async function postRequestCode(req: Request, res: Response): Promise<void> {
  const parsed = emailBody.safeParse(req.body);
  if (!parsed.success) throw badRequest("Email is required.");
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) throw badRequest("Enter a valid email address.");

  // Rate-limit per email and per IP (5 requests / 15 min each).
  const ip = req.ip ?? "unknown";
  if (!allow(`code:email:${email}`, 5, FIFTEEN_MIN) || !allow(`code:ip:${ip}`, 5, FIFTEEN_MIN)) {
    throw tooMany("Too many requests. Please wait a few minutes and try again.");
  }

  await requestCode(email);
  // Always 204 — never reveal whether the account exists.
  res.status(204).end();
}

export async function postVerifyCode(req: Request, res: Response): Promise<void> {
  const parsed = verifyBody.safeParse(req.body);
  if (!parsed.success) throw badRequest("Email and code are required.");
  const email = normalizeEmail(parsed.data.email);
  const code = parsed.data.code.replace(/\D/g, "");
  if (!isValidEmail(email) || code.length !== 6) throw badRequest("Enter the 6-digit code.");

  // Limit verification attempts per IP too (defense in depth).
  const ip = req.ip ?? "unknown";
  if (!allow(`verify:ip:${ip}`, 20, FIFTEEN_MIN)) {
    throw tooMany("Too many attempts. Please wait and try again.");
  }

  const { user, needsOnboarding } = await verifyCode(email, code);
  const sessionId = await createSession(user.id);
  setSessionCookie(res, sessionId);
  res.json({ user: toUserDTO(user), needsOnboarding });
}

export async function postLogout(req: Request, res: Response): Promise<void> {
  await destroySession(req);
  clearSessionCookie(res);
  res.status(204).end();
}
