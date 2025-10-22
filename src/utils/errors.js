/**
 * Error Handling Utilities
 * Custom error classes for different error scenarios
 */

/**
 * Base API Error class
 */
export class APIError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}

/**
 * Validation Error - for input validation failures
 */
export class ValidationError extends APIError {
  constructor(message) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

/**
 * Not Found Error - for missing resources
 */
export class NotFoundError extends APIError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/**
 * Unauthorized Error - for authentication failures
 */
export class UnauthorizedError extends APIError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden Error - for authorization failures
 */
export class ForbiddenError extends APIError {
  constructor(message = "Forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Conflict Error - for resource conflicts
 */
export class ConflictError extends APIError {
  constructor(message = "Resource conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

/**
 * Internal Server Error - for unexpected server errors
 */
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

  // Map common error patterns to appropriate API errors
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

  // Default to internal server error
  return new InternalServerError(
    error.message || "An unexpected error occurred",
  );
}
