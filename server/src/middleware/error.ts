import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

/** Final error handler — turns thrown errors into the JSON envelope { error: { code, message } }. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Something went wrong." } });
}

/** 404 for unknown /api routes (static files are handled before this). */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
}
