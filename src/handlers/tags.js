/**
 * Public Worker - Tag Handlers
 * Handles public tag operations
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { convertError } from '../utils/errors.js';

/**
 * GET /tags
 * Retrieve all active tags with post counts
 */
export async function handleGetTags(request, env, ctx, params, user) {
  try {
    // Fetch all tags with post counts
    // The post_count is automatically maintained by database triggers
    const result = await env.DB.prepare(`
      SELECT id, name, created_at, post_count
      FROM tags
      WHERE post_count > 0
      ORDER BY name ASC
    `).all();

    // Format response
    const tags = result.results.map(tag => ({
      id: tag.id,
      name: tag.name,
      postCount: tag.post_count,
      createdAt: tag.created_at
    }));

    const response = {
      success: true,
      data: tags,
      error: null
    };

    return jsonResponse(response, 200);

  } catch (error) {
    console.error('Error in handleGetTags:', error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
