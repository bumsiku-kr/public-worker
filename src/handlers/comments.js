import { jsonResponse, errorResponse } from "../utils/response.js";
import { convertError } from "../utils/errors.js";
import { createCommentRepository } from "../repositories/commentRepository.js";
import { createCommentService } from "../services/commentService.js";

/**
 * GET /comments/:postId
 * Retrieve all comments for a specific post
 */
export async function handleGetComments(_request, env, _ctx, params, _user) {
  try {
    const { postId } = params;

    const commentRepository = createCommentRepository(env);
    const commentService = createCommentService(commentRepository, env);

    const data = await commentService.getCommentsByPostId(postId);

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetComments:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}

/**
 * POST /comments/:postId
 * Create a new comment on a post
 */
export async function handleCreateComment(request, env, _ctx, params, _user) {
  try {
    const { postId } = params;

    const body = await request.json();

    const commentRepository = createCommentRepository(env);
    const commentService = createCommentService(commentRepository, env);

    const data = await commentService.createComment(postId, body);

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleCreateComment:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
