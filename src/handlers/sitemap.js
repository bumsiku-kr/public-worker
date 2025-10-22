/**
 * Public Worker - Sitemap Handler
 * Generates sitemap for SEO
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { convertError } from '../utils/errors.js';

/**
 * GET /sitemap
 * Generate sitemap with all published post slugs for SEO
 */
export async function handleGetSitemap(request, env, ctx, params, user) {
  try {
    // Fetch all published post slugs
    const result = await env.DB.prepare(`
      SELECT slug
      FROM posts
      WHERE state = 'published'
      ORDER BY created_at DESC
    `).all();

    // Extract slugs as simple array
    const slugs = result.results.map(post => post.slug);

    const response = {
      success: true,
      data: slugs,
      error: null
    };

    return jsonResponse(response, 200);

  } catch (error) {
    console.error('Error in handleGetSitemap:', error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
