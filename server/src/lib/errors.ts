/** Application error carrying an HTTP status + a stable machine code. */
export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.name = "AppError";
  }
}

export const badRequest = (msg?: string, code = "BAD_REQUEST") => new AppError(400, code, msg);
export const unauthorized = (msg?: string) => new AppError(401, "UNAUTHENTICATED", msg);
export const notFound = (msg?: string, code = "NOT_FOUND") => new AppError(404, code, msg);
export const tooMany = (msg?: string) => new AppError(429, "RATE_LIMITED", msg);
