/**
 * Public Worker - Sitemap Handler
 * Handles HTTP requests for sitemap generation
 * Single Responsibility: HTTP request/response handling only
 */

import { jsonResponse, errorResponse } from "../utils/response.js";
import { convertError } from "../utils/errors.js";
import { createTagRepository } from "../repositories/tagRepository.js";
import { createSitemapService } from "../services/sitemapService.js";

/**
 * GET /sitemap
 * Generate sitemap with all published post slugs for SEO
 */
export async function handleGetSitemap(_request, env, _ctx, _params, _user) {
  try {
    // Create service layer
    const tagRepository = createTagRepository(env);
    const sitemapService = createSitemapService(tagRepository);

    // Delegate to service layer
    const data = await sitemapService.generateSitemap();

    // Build success response
    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetSitemap:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
