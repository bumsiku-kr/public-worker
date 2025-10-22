/**
 * Public Worker - Post Handlers
 * Handles HTTP requests for public post endpoints
 * Single Responsibility: HTTP request/response handling only
 */

import { jsonResponse, errorResponse } from "../utils/response.js";
import { convertError } from "../utils/errors.js";
import { createPostRepository } from "../repositories/postRepository.js";
import { createPostService } from "../services/postService.js";

/**
 * GET /posts
 * Retrieve paginated list of posts with optional filtering and sorting
 */
export async function handleGetPosts(request, env, _ctx, _params, _user) {
  try {
    const url = new URL(request.url);

    // Extract query parameters
    const tag = url.searchParams.get("tag");
    const page = parseInt(url.searchParams.get("page") || "0", 10);
    const size = parseInt(url.searchParams.get("size") || "10", 10);
    const sort = url.searchParams.get("sort") || "createdAt,desc";

    // Create service layer
    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    // Delegate to service layer
    const data = await postService.getPosts({ tag, page, size, sort });

    // Build success response
    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetPosts:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}

/**
 * GET /posts/:slug
 * Retrieve single post by slug or ID
 * If ID provided, redirects to slug-based URL
 */
export async function handleGetPostBySlug(request, env, _ctx, params, _user) {
  try {
    const { slug } = params;

    // Create service layer
    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    // Delegate to service layer
    const result = await postService.getPostBySlug(slug);

    // Handle redirect case
    if (result.redirect) {
      const url = new URL(request.url);
      const redirectUrl = `${url.origin}/posts/${result.slug}`;

      return new Response(null, {
        status: 301,
        headers: {
          Location: redirectUrl,
        },
      });
    }

    // Build success response
    const response = {
      success: true,
      data: result.data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetPostBySlug:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}

/**
 * PATCH /posts/:postId/views
 * Increment post view count
 */
export async function handleIncrementViews(_request, env, _ctx, params, _user) {
  try {
    const { postId } = params;

    // Create service layer
    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    // Delegate to service layer
    const data = await postService.incrementPostViews(postId);

    // Build success response
    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleIncrementViews:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
