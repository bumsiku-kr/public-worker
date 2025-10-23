import { jsonResponse, errorResponse } from "../utils/response.js";
import { toAPIError } from "../utils/errors.js";
import { createLogger, createPerformanceTracker } from "../utils/logger.js";
import { createTagRepository } from "../repositories/tagRepository.js";
import { createTagService } from "../services/tagService.js";

/**
 * GET /tags
 * Retrieve all active tags with post counts
 */
export async function handleGetTags(
  _request,
  env,
  _ctx,
  _params,
  _user,
  requestId,
) {
  const logger = createLogger(requestId);

  try {
    logger.debug("Fetching active tags", {
      type: "handler",
      handler: "handleGetTags",
    });

    const tracker = createPerformanceTracker(logger, "getActiveTags");
    const tagRepository = createTagRepository(env);
    const tagService = createTagService(tagRepository);

    const data = await tagService.getActiveTags();
    tracker.end({ tagCount: data?.length || 0 });

    logger.info("Tags retrieved successfully", {
      type: "handler",
      handler: "handleGetTags",
      tagCount: data?.length || 0,
    });

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    logger.error("Error in handleGetTags", {
      type: "handler",
      handler: "handleGetTags",
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
