import { jsonResponse, errorResponse } from "../utils/response.js";
import { toAPIError } from "../utils/errors.js";
import { createLogger, createPerformanceTracker } from "../utils/logger.js";
import { createCommentRepository } from "../repositories/commentRepository.js";
import { createCommentService } from "../services/commentService.js";

/**
 * GET /comments/:postId
 * Retrieve all comments for a specific post
 */
export async function handleGetComments(
  _request,
  env,
  _ctx,
  params,
  _user,
  requestId,
) {
  const logger = createLogger(requestId);

  try {
    const { postId } = params;

    logger.debug("Fetching comments for post", {
      type: "handler",
      handler: "handleGetComments",
      postId,
    });

    const tracker = createPerformanceTracker(logger, "getCommentsByPostId");
    const commentRepository = createCommentRepository(env);
    const commentService = createCommentService(commentRepository, env);

    const data = await commentService.getCommentsByPostId(postId);
    tracker.end({ postId, commentCount: data?.length || 0 });

    logger.info("Comments retrieved successfully", {
      type: "handler",
      handler: "handleGetComments",
      postId,
      commentCount: data?.length || 0,
    });

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    logger.error("Error in handleGetComments", {
      type: "handler",
      handler: "handleGetComments",
      postId: params.postId,
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

/**
 * POST /comments/:postId
 * Create a new comment on a post
 */
export async function handleCreateComment(
  request,
  env,
  _ctx,
  params,
  body,
  requestId,
) {
  const logger = createLogger(requestId);

  try {
    const { postId } = params;

    logger.debug("Creating comment", {
      type: "handler",
      handler: "handleCreateComment",
      postId,
      author: body.author,
    });

    const tracker = createPerformanceTracker(logger, "createComment");
    const commentRepository = createCommentRepository(env);
    const commentService = createCommentService(commentRepository, env);

    const data = await commentService.createComment(postId, body);
    tracker.end({ postId, commentId: data.id });

    logger.info("Comment created successfully", {
      type: "handler",
      handler: "handleCreateComment",
      postId,
      commentId: data.id,
      author: body.author,
    });

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    logger.error("Error in handleCreateComment", {
      type: "handler",
      handler: "handleCreateComment",
      postId: params.postId,
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
