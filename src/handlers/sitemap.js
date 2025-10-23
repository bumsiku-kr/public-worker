import { jsonResponse, errorResponse } from "../utils/response.js";
import { toAPIError } from "../utils/errors.js";
import { createLogger, createPerformanceTracker } from "../utils/logger.js";
import { createTagRepository } from "../repositories/tagRepository.js";
import { createSitemapService } from "../services/sitemapService.js";

/**
 * GET /sitemap
 * Generate sitemap with all published post slugs for SEO
 */
export async function handleGetSitemap(
  _request,
  env,
  _ctx,
  _params,
  _user,
  requestId,
) {
  const logger = createLogger(requestId);

  try {
    logger.debug("Generating sitemap", {
      type: "handler",
      handler: "handleGetSitemap",
    });

    const tracker = createPerformanceTracker(logger, "generateSitemap");
    const tagRepository = createTagRepository(env);
    const sitemapService = createSitemapService(tagRepository);

    const data = await sitemapService.generateSitemap();
    tracker.end({ urlCount: data?.urls?.length || 0 });

    logger.info("Sitemap generated successfully", {
      type: "handler",
      handler: "handleGetSitemap",
      urlCount: data?.urls?.length || 0,
    });

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    logger.error("Error in handleGetSitemap", {
      type: "handler",
      handler: "handleGetSitemap",
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    });

    const apiError = toAPIError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
