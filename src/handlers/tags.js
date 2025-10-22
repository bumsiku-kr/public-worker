/**
 * Public Worker - Tag Handlers
 * Handles HTTP requests for public tag endpoints
 * Single Responsibility: HTTP request/response handling only
 */

import { jsonResponse, errorResponse } from "../utils/response.js";
import { convertError } from "../utils/errors.js";
import { createTagRepository } from "../repositories/tagRepository.js";
import { createTagService } from "../services/tagService.js";

/**
 * GET /tags
 * Retrieve all active tags with post counts
 */
export async function handleGetTags(_request, env, _ctx, _params, _user) {
  try {
    // Create service layer
    const tagRepository = createTagRepository(env);
    const tagService = createTagService(tagRepository);

    // Delegate to service layer
    const data = await tagService.getActiveTags();

    // Build success response
    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetTags:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
