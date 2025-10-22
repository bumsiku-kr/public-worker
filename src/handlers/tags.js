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
    const tagRepository = createTagRepository(env);
    const tagService = createTagService(tagRepository);

    const data = await tagService.getActiveTags();

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
