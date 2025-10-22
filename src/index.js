import { router } from "./router.js";
import { errorResponse, handleCORS, addCORSHeaders } from "./utils/response.js";
import { toAPIError } from "./utils/errors.js";

export default {
  async fetch(request, env, ctx) {
    try {
      const allowedOrigins = env.ALLOWED_ORIGINS || "*";

      if (request.method === "OPTIONS") {
        return handleCORS(allowedOrigins);
      }

      const response = await router(request, env, ctx);

      return addCORSHeaders(response, allowedOrigins);
    } catch (error) {
      console.error("Public Worker Error:", error);

      const apiError = toAPIError(error);
      const errorResp = errorResponse(apiError.message, apiError.status);

      return addCORSHeaders(errorResp, env.ALLOWED_ORIGINS || "*");
    }
  },
};
