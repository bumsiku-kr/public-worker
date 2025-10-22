/**
 * Public Worker - Post Handlers
 * Handles public post retrieval endpoints
 */

import { jsonResponse, errorResponse } from "../utils/response.js";
import {
  NotFoundError,
  ValidationError,
  convertError,
} from "../utils/errors.js";
import { validatePagination, validateSorting } from "../utils/validation.js";
import { withCache, invalidatePostCache } from "../utils/cache.js";

/**
 * GET /posts
 * Retrieve paginated list of posts with optional filtering and sorting
 */
export async function handleGetPosts(request, env, ctx, params, user) {
  try {
    const url = new URL(request.url);

    // Extract query parameters
    const tag = url.searchParams.get("tag");
    const page = parseInt(url.searchParams.get("page") || "0", 10);
    const size = parseInt(url.searchParams.get("size") || "10", 10);
    const sortParam = url.searchParams.get("sort") || "createdAt,desc";

    // Validate pagination
    const paginationErrors = validatePagination({ page, size });
    if (paginationErrors.length > 0) {
      throw new ValidationError(paginationErrors.join(", "));
    }

    // Validate and parse sorting
    const sortErrors = validateSorting(sortParam, [
      "createdAt",
      "updatedAt",
      "views",
      "title",
    ]);
    if (sortErrors.length > 0) {
      throw new ValidationError(sortErrors.join(", "));
    }

    const [sortField, sortDirection] = sortParam.split(",");
    const orderClause = `${sortField} ${sortDirection.toUpperCase()}`;

    // Build query based on filters
    let query;
    let countQuery;
    const offset = page * size;

    if (tag) {
      // Filter by tag - need to join with post_tags and tags
      query = `
        SELECT DISTINCT p.id, p.slug, p.title, p.summary, p.created_at, p.updated_at, p.views
        FROM posts p
        INNER JOIN post_tags pt ON p.id = pt.post_id
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ? AND p.state = 'published'
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM posts p
        INNER JOIN post_tags pt ON p.id = pt.post_id
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ? AND p.state = 'published'
      `;
    } else {
      // No filter - get all published posts
      query = `
        SELECT id, slug, title, summary, created_at, updated_at, views
        FROM posts
        WHERE state = 'published'
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) as total
        FROM posts
        WHERE state = 'published'
      `;
    }

    // Execute queries
    const postsResult = tag
      ? await env.DB.prepare(query).bind(tag, size, offset).all()
      : await env.DB.prepare(query).bind(size, offset).all();

    const countResult = tag
      ? await env.DB.prepare(countQuery).bind(tag).first()
      : await env.DB.prepare(countQuery).first();

    // Fetch tags for each post
    const postsWithTags = await Promise.all(
      postsResult.results.map(async (post) => {
        const tagsResult = await env.DB.prepare(
          `
          SELECT t.name
          FROM tags t
          INNER JOIN post_tags pt ON t.id = pt.tag_id
          WHERE pt.post_id = ?
          ORDER BY t.name
        `,
        )
          .bind(post.id)
          .all();

        return {
          id: post.id,
          slug: post.slug,
          title: post.title,
          summary: post.summary,
          tags: tagsResult.results.map((t) => t.name),
          createdAt: post.created_at,
          updatedAt: post.updated_at,
          views: post.views,
        };
      }),
    );

    // Build paginated response
    const response = {
      success: true,
      data: {
        content: postsWithTags,
        totalElements: countResult.total,
        pageNumber: page,
        pageSize: size,
      },
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
export async function handleGetPostBySlug(request, env, ctx, params, user) {
  try {
    const { slug } = params;

    if (!slug) {
      throw new ValidationError("Slug parameter is required");
    }

    // Check if slug is numeric (ID)
    const isNumericId = /^\d+$/.test(slug);

    let post;

    if (isNumericId) {
      // Fetch by ID to get slug for redirect
      const result = await env.DB.prepare(
        `
        SELECT slug
        FROM posts
        WHERE id = ? AND state = 'published'
      `,
      )
        .bind(parseInt(slug, 10))
        .first();

      if (!result) {
        throw new NotFoundError("Post not found");
      }

      // Return 301 redirect to slug-based URL
      const url = new URL(request.url);
      const redirectUrl = `${url.origin}/posts/${result.slug}`;

      return new Response(null, {
        status: 301,
        headers: {
          Location: redirectUrl,
        },
      });
    }

    // Fetch by slug
    post = await env.DB.prepare(
      `
      SELECT id, slug, title, content, summary, state, created_at, updated_at, views
      FROM posts
      WHERE slug = ? AND state = 'published'
    `,
    )
      .bind(slug)
      .first();

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // Fetch tags for this post
    const tagsResult = await env.DB.prepare(
      `
      SELECT t.name
      FROM tags t
      INNER JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
      ORDER BY t.name
    `,
    )
      .bind(post.id)
      .all();

    // Build response
    const response = {
      success: true,
      data: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        summary: post.summary,
        tags: tagsResult.results.map((t) => t.name),
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        views: post.views,
      },
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
export async function handleIncrementViews(request, env, ctx, params, user) {
  try {
    const { postId } = params;

    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    // Increment views
    await env.DB.prepare(
      `
      UPDATE posts
      SET views = views + 1
      WHERE id = ? AND state = 'published'
    `,
    )
      .bind(id)
      .run();

    // Fetch updated view count
    const result = await env.DB.prepare(
      `
      SELECT views
      FROM posts
      WHERE id = ?
    `,
    )
      .bind(id)
      .first();

    if (!result) {
      throw new NotFoundError("Post not found");
    }

    // Invalidate cache for this post
    if (env.CACHE) {
      await invalidatePostCache(env.CACHE, id);
    }

    const response = {
      success: true,
      data: {
        views: result.views,
      },
      error: null,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Error in handleIncrementViews:", error);
    const apiError = convertError(error);
    return errorResponse(apiError.message, apiError.status);
  }
}
