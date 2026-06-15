import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../db/client";

const COOKIE = "pp_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + MAX_AGE_MS) },
  });
  return session.id;
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
}

/** Resolve the logged-in user from the session cookie, or null. */
export async function getUserFromRequest(req: Request): Promise<User | null> {
  const sessionId = req.cookies?.[COOKIE];
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function destroySession(req: Request): Promise<void> {
  const sessionId = req.cookies?.[COOKIE];
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }
}
