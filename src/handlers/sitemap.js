import { jsonResponse, errorResponse } from "../utils/response.js";
import { toAPIError } from "../utils/errors.js";
import { createTagRepository } from "../repositories/tagRepository.js";
import { createSitemapService } from "../services/sitemapService.js";

/**
 * GET /sitemap
 * Generate sitemap with all published post slugs for SEO
 */
export async function handleGetSitemap(_request, env, _ctx, _params, _user) {
  try {
    const tagRepository = createTagRepository(env);
    const sitemapService = createSitemapService(tagRepository);

    const data = await sitemapService.generateSitemap();

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetSitemap:", error);
    const apiError = toAPIError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
