export class APIError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}

export class ValidationError extends APIError {
  constructor(message) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends APIError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends APIError {
  constructor(message = "Forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends APIError {
  constructor(message = "Resource conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export class InternalServerError extends APIError {
  constructor(message = "Internal server error") {
    super(message, 500);
    this.name = "InternalServerError";
  }
}

/**
 * Convert any error to an APIError with appropriate status
 * @param {Error} error - Error to convert
 * @returns {APIError}
 */
export function toAPIError(error) {
  if (error instanceof APIError) {
    return error;
  }

  if (error.message.includes("not found")) {
    return new NotFoundError(error.message);
  }

  if (
    error.message.includes("unauthorized") ||
    error.message.includes("authentication")
  ) {
    return new UnauthorizedError(error.message);
  }

  if (
    error.message.includes("forbidden") ||
    error.message.includes("permission")
  ) {
    return new ForbiddenError(error.message);
  }

  if (
    error.message.includes("validation") ||
    error.message.includes("invalid")
  ) {
    return new ValidationError(error.message);
  }

  if (
    error.message.includes("conflict") ||
    error.message.includes("duplicate")
  ) {
    return new ConflictError(error.message);
  }

  return new InternalServerError(
    error.message || "An unexpected error occurred",
  );
}
