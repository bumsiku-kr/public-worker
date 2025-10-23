import { router } from "./router.js";
import { errorResponse, handleCORS, addCORSHeaders } from "./utils/response.js";
import { toAPIError } from "./utils/errors.js";
import {
  createLogger,
  logRequest,
  logResponse,
  logError,
} from "./utils/logger.js";

export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // Log incoming request
    const logger = logRequest(request, requestId);

    try {
      const allowedOrigins = env.ALLOWED_ORIGINS || "*";

      if (request.method === "OPTIONS") {
        const response = handleCORS(allowedOrigins);
        const duration = Date.now() - startTime;

        logResponse(request, response, requestId, duration);

        // Add request ID header for tracing
        const headersWithRequestId = new Headers(response.headers);
        headersWithRequestId.set("X-Request-ID", requestId);

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headersWithRequestId,
        });
      }

      const response = await router(request, env, ctx, requestId);
      const duration = Date.now() - startTime;

      // Log successful response
      logResponse(request, response, requestId, duration);

      // Add request ID and CORS headers
      const finalResponse = addCORSHeaders(response, allowedOrigins);
      const headersWithRequestId = new Headers(finalResponse.headers);
      headersWithRequestId.set("X-Request-ID", requestId);

      return new Response(finalResponse.body, {
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        headers: headersWithRequestId,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error with full context
      logError(error, request, requestId, {
        performance: {
          duration: `${duration}ms`,
          durationMs: duration,
        },
      });

      const apiError = toAPIError(error);
      const errorResp = errorResponse(apiError.message, apiError.status);
      const finalResponse = addCORSHeaders(errorResp, env.ALLOWED_ORIGINS || "*");

      // Add request ID header for error tracing
      const headersWithRequestId = new Headers(finalResponse.headers);
      headersWithRequestId.set("X-Request-ID", requestId);

      return new Response(finalResponse.body, {
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        headers: headersWithRequestId,
      });
    }
  },
};
