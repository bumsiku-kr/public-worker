/**
 * Public Worker - Main Entry Point
 * Handles public API requests (no authentication)
 */

import { router } from './router.js';
import { errorResponse, handleCORS, addCORSHeaders } from './utils/response.js';
import { toAPIError } from './utils/errors.js';

export default {
  async fetch(request, env, ctx) {
    try {
      const allowedOrigins = env.ALLOWED_ORIGINS || '*';

      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return handleCORS(allowedOrigins);
      }

      // Route request through router (no auth needed)
      const response = await router(request, env, ctx);

      // Add CORS headers to response
      return addCORSHeaders(response, allowedOrigins);

    } catch (error) {
      console.error('Public Worker Error:', error);

      // Convert to API error and return error response
      const apiError = toAPIError(error);
      const errorResp = errorResponse(apiError.message, apiError.status);

      // Add CORS headers to error response
      return addCORSHeaders(errorResp, env.ALLOWED_ORIGINS || '*');
    }
  }
};
