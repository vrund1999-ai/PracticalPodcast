import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { getUserFromRequest } from "../services/session.service";
import { unauthorized } from "../lib/errors";

/** Populates req.user or responds 401. (Express 5 forwards async rejections.) */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const user = await getUserFromRequest(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

/** Non-null accessor for use inside protected controllers. */
export function authedUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}
