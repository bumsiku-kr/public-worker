/**
 * Cloudflare Workers Observability Logger
 *
 * Provides structured logging for requests, responses, and errors
 * optimized for Cloudflare Workers observability platform.
 *
 * Features:
 * - Request/Response tracking with correlation IDs
 * - Performance metrics (duration, status codes)
 * - Error tracking with stack traces
 * - Structured JSON logging for better parsing
 * - Integration with Cloudflare's observability platform
 */

/**
 * Log levels aligned with Cloudflare Workers observability
 */
export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
};

/**
 * Generate unique request ID for correlation
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers) {
  const sanitized = {};
  const sensitiveHeaders = [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
  ];

  for (const [key, value] of headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extract useful request context for logging
 */
function getRequestContext(request) {
  const url = new URL(request.url);

  return {
    method: request.method,
    url: url.pathname + url.search,
    origin: url.origin,
    cf: request.cf
      ? {
          colo: request.cf.colo,
          country: request.cf.country,
          city: request.cf.city,
          asn: request.cf.asn,
          httpProtocol: request.cf.httpProtocol,
        }
      : undefined,
  };
}

/**
 * Format log entry with structured data
 */
function formatLogEntry(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  return entry;
}

/**
 * Core logging function
 */
function log(level, message, data = {}) {
  const entry = formatLogEntry(level, message, data);

  // Cloudflare Workers console methods map to observability log levels
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(JSON.stringify(entry));
      break;
    case LogLevel.INFO:
      console.info(JSON.stringify(entry));
      break;
    case LogLevel.WARN:
      console.warn(JSON.stringify(entry));
      break;
    case LogLevel.ERROR:
      console.error(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
  }
}

/**
 * Create logger instance with request context
 */
export function createLogger(requestId) {
  return {
    debug: (message, data = {}) =>
      log(LogLevel.DEBUG, message, { requestId, ...data }),
    info: (message, data = {}) =>
      log(LogLevel.INFO, message, { requestId, ...data }),
    warn: (message, data = {}) =>
      log(LogLevel.WARN, message, { requestId, ...data }),
    error: (message, data = {}) =>
      log(LogLevel.ERROR, message, { requestId, ...data }),
  };
}

/**
 * Log incoming request
 */
export function logRequest(request, requestId) {
  const context = getRequestContext(request);
  const headers = sanitizeHeaders(request.headers);

  const logger = createLogger(requestId);
  logger.info("Incoming request", {
    type: "request",
    request: {
      ...context,
      headers,
    },
  });

  return logger;
}

/**
 * Log outgoing response
 */
export function logResponse(request, response, requestId, duration) {
  const context = getRequestContext(request);
  const logger = createLogger(requestId);

  logger.info("Outgoing response", {
    type: "response",
    request: {
      method: context.method,
      url: context.url,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: sanitizeHeaders(response.headers),
    },
    performance: {
      duration: `${duration}ms`,
      durationMs: duration,
    },
  });
}

/**
 * Log error with full context
 */
export function logError(error, request, requestId, context = {}) {
  const requestContext = getRequestContext(request);
  const logger = createLogger(requestId);

  const errorData = {
    type: "error",
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause
        ? {
            message: error.cause.message,
            name: error.cause.name,
          }
        : undefined,
    },
    request: {
      method: requestContext.method,
      url: requestContext.url,
    },
    ...context,
  };

  logger.error(error.message, errorData);
}

/**
 * Middleware wrapper for request/response logging
 */
export function withLogging(handler) {
  return async (request, env, ctx, ...args) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Log incoming request
    logRequest(request, requestId);

    try {
      // Execute handler
      const response = await handler(request, env, ctx, ...args);

      // Log successful response
      const duration = Date.now() - startTime;
      logResponse(request, response, requestId, duration);

      // Add request ID to response headers for tracing
      const headersWithRequestId = new Headers(response.headers);
      headersWithRequestId.set("X-Request-ID", requestId);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headersWithRequestId,
      });
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      logError(error, request, requestId, {
        performance: {
          duration: `${duration}ms`,
          durationMs: duration,
        },
      });

      // Re-throw to let error handler deal with it
      throw error;
    }
  };
}

/**
 * Create performance tracker for operations
 */
export function createPerformanceTracker(logger, operation) {
  const startTime = Date.now();

  return {
    end: (additionalData = {}) => {
      const duration = Date.now() - startTime;
      logger.debug(`Operation completed: ${operation}`, {
        operation,
        performance: {
          duration: `${duration}ms`,
          durationMs: duration,
        },
        ...additionalData,
      });
      return duration;
    },
  };
}

/**
 * Log database query
 */
export function logDatabaseQuery(logger, query, params = {}) {
  logger.debug("Database query", {
    type: "database",
    query,
    params,
  });
}

/**
 * Log cache operation
 */
export function logCacheOperation(logger, operation, key, hit = null) {
  logger.debug("Cache operation", {
    type: "cache",
    operation,
    key,
    hit: hit !== null ? hit : undefined,
  });
}

/**
 * Log API call to external service
 */
export function logExternalAPICall(logger, service, endpoint, method) {
  logger.debug("External API call", {
    type: "external_api",
    service,
    endpoint,
    method,
  });
}
