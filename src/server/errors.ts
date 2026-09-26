/** Domain error carrying an HTTP status, a stable code and optional field-level messages. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, "BAD_REQUEST", message, fields);

export const unauthorized = (message = "Please sign in to continue") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You do not have permission to perform this action") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (entity = "Record") => new AppError(404, "NOT_FOUND", `${entity} not found`);

export const conflict = (message: string, fields?: Record<string, string>) =>
  new AppError(409, "CONFLICT", message, fields);

export const validationError = (
  fields: Record<string, string>,
  message = "Please fix the highlighted fields",
) => new AppError(422, "VALIDATION_ERROR", message, fields);

export const tooManyRequests = (message: string) => new AppError(429, "TOO_MANY_REQUESTS", message);
