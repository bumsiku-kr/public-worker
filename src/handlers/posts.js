import { jsonResponse, errorResponse } from "../utils/response.js";
import { toAPIError } from "../utils/errors.js";
import { createPostRepository } from "../repositories/postRepository.js";
import { createPostService } from "../services/postService.js";

/**
 * GET /posts
 * Retrieve paginated list of posts with optional filtering and sorting
 */
export async function handleGetPosts(request, env, _ctx, _params, _user) {
  try {
    const url = new URL(request.url);

    const tag = url.searchParams.get("tag");
    const page = parseInt(url.searchParams.get("page") || "0", 10);
    const size = parseInt(url.searchParams.get("size") || "10", 10);
    const sort = url.searchParams.get("sort") || "createdAt,desc";

    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    const data = await postService.getPosts({ tag, page, size, sort });

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetPosts:", error);
    const apiError = toAPIError(error);
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

    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    const result = await postService.getPostBySlug(slug);

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

    const response = {
      success: true,
      data: result.data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleGetPostBySlug:", error);
    const apiError = toAPIError(error);
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

    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    const data = await postService.incrementPostViews(postId);

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleIncrementViews:", error);
    const apiError = toAPIError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
