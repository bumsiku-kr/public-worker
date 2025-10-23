import { jsonResponse, errorResponse } from "../utils/response.js";
import { toAPIError } from "../utils/errors.js";
import { createLogger, createPerformanceTracker } from "../utils/logger.js";
import { createPostRepository } from "../repositories/postRepository.js";
import { createPostService } from "../services/postService.js";

/**
 * GET /posts
 * Retrieve paginated list of posts with optional filtering and sorting
 */
export async function handleGetPosts(
  request,
  env,
  _ctx,
  _params,
  _user,
  requestId,
) {
  const logger = createLogger(requestId);

  try {
    const url = new URL(request.url);

    const tag = url.searchParams.get("tag");
    const page = parseInt(url.searchParams.get("page") || "0", 10);
    const size = parseInt(url.searchParams.get("size") || "10", 10);
    const sort = url.searchParams.get("sort") || "createdAt,desc";

    logger.debug("Fetching posts", {
      type: "handler",
      handler: "handleGetPosts",
      params: { tag, page, size, sort },
      envKeys: Object.keys(env || {}),
      hasDB: !!env?.DB,
    });

    if (!env || !env.DB) {
      logger.error("Database binding not found", {
        type: "handler",
        handler: "handleGetPosts",
        env: env ? "exists but no DB" : "env is undefined",
        envKeys: env ? Object.keys(env) : [],
      });
      throw new Error("Database binding (DB) not configured");
    }

    const tracker = createPerformanceTracker(logger, "getPosts");
    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    const data = await postService.getPosts({ tag, page, size, sort });
    tracker.end({
      resultCount: data.content?.length || 0,
      totalElements: data.totalElements,
    });

    logger.info("Posts retrieved successfully", {
      type: "handler",
      handler: "handleGetPosts",
      resultCount: data.content?.length || 0,
      totalElements: data.totalElements,
    });

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    logger.error("Error in handleGetPosts", {
      type: "handler",
      handler: "handleGetPosts",
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
 * GET /posts/:slug
 * Retrieve single post by slug or ID
 * If ID provided, redirects to slug-based URL
 */
export async function handleGetPostBySlug(
  request,
  env,
  _ctx,
  params,
  _user,
  requestId,
) {
  const logger = createLogger(requestId);

  try {
    const { slug } = params;

    logger.debug("Fetching post by slug", {
      type: "handler",
      handler: "handleGetPostBySlug",
      slug,
    });

    const tracker = createPerformanceTracker(logger, "getPostBySlug");
    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    const result = await postService.getPostBySlug(slug);
    tracker.end({ slug, redirect: result.redirect });

    if (result.redirect) {
      const url = new URL(request.url);
      const redirectUrl = `${url.origin}/posts/${result.slug}`;

      logger.info("Redirecting to slug-based URL", {
        type: "handler",
        handler: "handleGetPostBySlug",
        from: slug,
        to: result.slug,
        redirectUrl,
      });

      return new Response(null, {
        status: 301,
        headers: {
          Location: redirectUrl,
        },
      });
    }

    logger.info("Post retrieved successfully", {
      type: "handler",
      handler: "handleGetPostBySlug",
      postId: result.data?.id,
      slug,
    });

    const response = {
      success: true,
      data: result.data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    logger.error("Error in handleGetPostBySlug", {
      type: "handler",
      handler: "handleGetPostBySlug",
      slug: params.slug,
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
 * PATCH /posts/:postId/views
 * Increment post view count
 */
export async function handleIncrementViews(
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

    logger.debug("Incrementing post views", {
      type: "handler",
      handler: "handleIncrementViews",
      postId,
    });

    const tracker = createPerformanceTracker(logger, "incrementPostViews");
    const postRepository = createPostRepository(env);
    const postService = createPostService(postRepository, env);

    const data = await postService.incrementPostViews(postId);
    tracker.end({ postId, newViewCount: data.views });

    logger.info("Post views incremented", {
      type: "handler",
      handler: "handleIncrementViews",
      postId,
      newViewCount: data.views,
    });

    const response = {
      success: true,
      data,
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    logger.error("Error in handleIncrementViews", {
      type: "handler",
      handler: "handleIncrementViews",
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
